import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { placeOrder, CheckoutError } from "@/server/services/checkout";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";

// Checkout is the one place a cart becomes a real Order + reserved stock
// (DATABASE.md §5) — verified end-to-end against the real database.

const PREFIX = "checkout-test-";

let buyerId: string;
let addressId: string;
let sellerAId: string;
let sellerBId: string;
let warehouseAId: string;
let warehouseBId: string;
let categoryId: string;
let productAId: string;
let productBId: string;
let inventoryAId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [buyer, userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Checkout",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-a-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "A",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-b-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "B",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Checkout Buyer",
      phone: "+962700000000",
      countryCode: "JO",
      city: "Amman",
      addressLine1: "1 Test Street",
      isDefault: true,
    },
  });
  addressId = address.id;

  const [sellerA, sellerB] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: userA.id,
        storeSlug: `${PREFIX}store-a-${Date.now()}`,
        storeName: "Checkout Test Store A",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: userB.id,
        storeSlug: `${PREFIX}store-b-${Date.now()}`,
        storeName: "Checkout Test Store B",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;

  const [warehouseA, warehouseB] = await Promise.all([
    prisma.warehouse.create({
      data: { sellerId: sellerAId, name: "A Warehouse", countryCode: "JO", city: "Amman" },
    }),
    prisma.warehouse.create({
      data: { sellerId: sellerBId, name: "B Warehouse", countryCode: "JO", city: "Amman" },
    }),
  ]);
  warehouseAId = warehouseA.id;
  warehouseBId = warehouseB.id;

  const [productA, productB] = await Promise.all([
    prisma.product.create({
      data: {
        sellerId: sellerAId,
        categoryId,
        slug: `${PREFIX}product-a-${Date.now()}`,
        sku: "CHK-A-1",
        name: "Checkout Test Product A",
        price: "20.00",
        costPrice: "10.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId: sellerBId,
        categoryId,
        slug: `${PREFIX}product-b-${Date.now()}`,
        sku: "CHK-B-1",
        name: "Checkout Test Product B",
        price: "15.00",
        costPrice: "7.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
  ]);
  productAId = productA.id;
  productBId = productB.id;

  const inventoryA = await recordInventoryMovementStandalone({
    productId: productAId,
    warehouseId: warehouseAId,
    type: "PURCHASE",
    quantity: 5,
    reason: "test opening stock",
  });
  inventoryAId = inventoryA.id;

  await recordInventoryMovementStandalone({
    productId: productBId,
    warehouseId: warehouseBId,
    type: "PURCHASE",
    quantity: 5,
    reason: "test opening stock",
  });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { product: { id: { in: [productAId, productBId] } } } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  await prisma.inventoryMovement.deleteMany({
    where: { inventory: { productId: { in: [productAId, productBId] } } },
  });
  await prisma.inventory.deleteMany({ where: { productId: { in: [productAId, productBId] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productAId, productBId] } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseAId, warehouseBId] } } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerAId, sellerBId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("placeOrder", () => {
  it("fans a multi-seller cart out into one SellerOrder per seller and reserves stock", async () => {
    const cart = await prisma.cart.create({ data: { userId: buyerId, currencyCode: "USD" } });
    await prisma.cartItem.createMany({
      data: [
        { cartId: cart.id, productId: productAId, quantity: 2 },
        { cartId: cart.id, productId: productBId, quantity: 1 },
      ],
    });

    const order = await placeOrder(buyerId, addressId);

    expect(order.subtotal.toString()).toBe("55"); // 2×20 + 1×15
    expect(order.grandTotal.toString()).toBe("55"); // no tax/shipping rules configured

    const sellerOrders = await prisma.sellerOrder.findMany({
      where: { orderId: order.id },
      include: { items: true },
    });
    expect(sellerOrders).toHaveLength(2);

    const remainingCartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    expect(remainingCartItems).toHaveLength(0);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    expect(inventory.reserved).toBe(2);
    expect(inventory.quantity).toBe(5); // reservation, not a decrement
  });

  it("refuses to place an order for an empty cart", async () => {
    // The first test's cart still exists (placeOrder empties it but doesn't
    // delete the row) — Cart.userId is unique, so reuse it rather than
    // creating a second one for the same buyer.
    await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await expect(placeOrder(buyerId, addressId)).rejects.toBeInstanceOf(CheckoutError);
  });

  it("refuses to reserve more stock than is available", async () => {
    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    // Only 3 units of A remain available (5 - 2 reserved by the first test).
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: productAId, quantity: 4 },
    });

    await expect(placeOrder(buyerId, addressId)).rejects.toThrow();

    const ordersAfter = await prisma.order.count({ where: { userId: buyerId } });
    expect(ordersAfter).toBe(1); // only the first, successful order exists

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  });
});
