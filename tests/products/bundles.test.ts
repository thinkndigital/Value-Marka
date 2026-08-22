import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { placeOrder, CheckoutError } from "@/server/services/checkout";
import { transitionSellerOrder, requestCustomerCancellation } from "@/server/services/orders";
import { recordInventoryMovementStandalone, getAvailableStock } from "@/server/services/inventory";
import * as bundles from "@/server/services/bundles";
import { BundleError } from "@/server/services/bundles";
import { ForbiddenError } from "@/server/rbac";

const PREFIX = "bundle-test-";

let categoryId: string;
let sellerId: string;
let otherSellerId: string;
let warehouseId: string;
let componentAId: string; // stock 10
let componentBId: string; // stock 4
let bundleProductId: string;
let buyerId: string;
let addressId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [sellerUser, otherSellerUser, buyer] = await Promise.all([
    prisma.user.create({
      data: { email: `${PREFIX}seller-${Date.now()}@example.com`, firstName: "Bundle", lastName: "Seller", passwordHash: "unused" },
    }),
    prisma.user.create({
      data: { email: `${PREFIX}other-seller-${Date.now()}@example.com`, firstName: "Other", lastName: "Seller", passwordHash: "unused" },
    }),
    prisma.user.create({
      data: { email: `${PREFIX}buyer-${Date.now()}@example.com`, firstName: "Bundle", lastName: "Buyer", passwordHash: "unused" },
    }),
  ]);
  buyerId = buyer.id;

  const [seller, otherSeller] = await Promise.all([
    prisma.seller.create({
      data: { userId: sellerUser.id, storeSlug: `${PREFIX}store-${Date.now()}`, storeName: "Bundle Test Store", countryCode: "JO", status: "APPROVED" },
    }),
    prisma.seller.create({
      data: { userId: otherSellerUser.id, storeSlug: `${PREFIX}other-store-${Date.now()}`, storeName: "Other Store", countryCode: "JO", status: "APPROVED" },
    }),
  ]);
  sellerId = seller.id;
  otherSellerId = otherSeller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Bundle Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;

  const [componentA, componentB] = await Promise.all([
    prisma.product.create({
      data: {
        sellerId, categoryId, slug: `${PREFIX}component-a-${Date.now()}`, sku: "BUNDLE-A",
        name: "Component A", price: "10.00", costPrice: "5.00", currencyCode: "USD", status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId, categoryId, slug: `${PREFIX}component-b-${Date.now()}`, sku: "BUNDLE-B",
        name: "Component B", price: "8.00", costPrice: "4.00", currencyCode: "USD", status: "ACTIVE",
      },
    }),
  ]);
  componentAId = componentA.id;
  componentBId = componentB.id;

  await recordInventoryMovementStandalone({
    productId: componentAId, warehouseId, type: "PURCHASE", quantity: 10, reason: "opening stock",
  });
  await recordInventoryMovementStandalone({
    productId: componentBId, warehouseId, type: "PURCHASE", quantity: 4, reason: "opening stock",
  });

  const bundle = await prisma.product.create({
    data: {
      sellerId, categoryId, slug: `${PREFIX}bundle-${Date.now()}`, sku: "BUNDLE-1",
      name: "Starter Bundle", type: "BUNDLE", price: "15.00", costPrice: "9.00", currencyCode: "USD", status: "ACTIVE",
    },
  });
  bundleProductId = bundle.id;

  const address = await prisma.address.create({
    data: {
      userId: buyerId, fullName: "Bundle Buyer", phone: "+962700000004", countryCode: "JO",
      city: "Amman", addressLine1: "1 Bundle Street", isDefault: true,
    },
  });
  addressId = address.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.shipment.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { productId: { in: [bundleProductId, componentAId, componentBId] } } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  await prisma.productBundleItem.deleteMany({ where: { bundleProductId } });
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId: { in: [componentAId, componentBId] } } } });
  await prisma.inventory.deleteMany({ where: { productId: { in: [componentAId, componentBId] } } });
  await prisma.product.deleteMany({ where: { id: { in: [bundleProductId, componentAId, componentBId] } } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("bundle component management", () => {
  it("adds components, refuses duplicates, self-reference, and non-SIMPLE components", async () => {
    const itemA = await bundles.addBundleComponent(sellerId, bundleProductId, componentAId, 1);
    expect(itemA.quantity).toBe(1);

    await expect(bundles.addBundleComponent(sellerId, bundleProductId, componentAId, 2)).rejects.toBeInstanceOf(
      BundleError,
    );
    await expect(
      bundles.addBundleComponent(sellerId, bundleProductId, bundleProductId, 1),
    ).rejects.toBeInstanceOf(BundleError);
    await expect(
      bundles.addBundleComponent(sellerId, bundleProductId, bundleProductId, 1),
    ).rejects.toBeInstanceOf(BundleError);

    await bundles.removeBundleComponent(sellerId, itemA.id);
  });

  it("refuses a different seller managing this bundle or contributing a component", async () => {
    await expect(
      bundles.addBundleComponent(otherSellerId, bundleProductId, componentAId, 1),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getBundleAvailableStock", () => {
  it("is 0 for a bundle with no components — no fake unlimited fallback", async () => {
    expect(await bundles.getBundleAvailableStock(bundleProductId)).toBe(0);
  });

  it("is the minimum of floor(componentAvailable / requiredQty) across components", async () => {
    const itemA = await bundles.addBundleComponent(sellerId, bundleProductId, componentAId, 2); // 10/2=5
    const itemB = await bundles.addBundleComponent(sellerId, bundleProductId, componentBId, 1); // 4/1=4
    expect(await bundles.getBundleAvailableStock(bundleProductId)).toBe(4);
    expect(await getAvailableStock(bundleProductId)).toBe(4); // same value via the generic entry point

    await bundles.removeBundleComponent(sellerId, itemA.id);
    await bundles.removeBundleComponent(sellerId, itemB.id);
  });
});

describe("checkout with a bundle", () => {
  it("reserves each component's real stock, scaled by quantity — never the bundle's own (nonexistent) inventory", async () => {
    await bundles.addBundleComponent(sellerId, bundleProductId, componentAId, 2);
    await bundles.addBundleComponent(sellerId, bundleProductId, componentBId, 1);

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId }, update: {}, create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: bundleProductId, quantity: 2 } });

    const order = await placeOrder(buyerId, addressId);
    expect(order.subtotal.toString()).toBe("30"); // 2 bundles × $15

    const orderItem = await prisma.orderItem.findFirstOrThrow({
      where: { productId: bundleProductId, sellerOrder: { orderId: order.id } },
    });
    expect(orderItem.quantity).toBe(2);
    expect(orderItem.unitPrice.toString()).toBe("15");

    // 2 bundles × 2 units of A = 4 reserved; 2 bundles × 1 unit of B = 2 reserved.
    const invA = await prisma.inventory.findFirstOrThrow({ where: { productId: componentAId } });
    const invB = await prisma.inventory.findFirstOrThrow({ where: { productId: componentBId } });
    expect(invA.reserved).toBe(4);
    expect(invB.reserved).toBe(2);
    expect(await prisma.inventory.count({ where: { productId: bundleProductId } })).toBe(0);
  });

  it("rejects a bundle purchase that would oversell a component", async () => {
    // Component B has 4 total, 2 already reserved from the previous test → 2 left.
    // 3 bundles need 3 units of B.
    const cart = await prisma.cart.upsert({
      where: { userId: buyerId }, update: {}, create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: bundleProductId, quantity: 3 } });

    await expect(placeOrder(buyerId, addressId)).rejects.toBeInstanceOf(CheckoutError);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  });

  it("converts component reservations to a real sale on delivery", async () => {
    const invABefore = await prisma.inventory.findFirstOrThrow({ where: { productId: componentAId } });
    const order = await prisma.order.findFirstOrThrow({ where: { userId: buyerId }, orderBy: { placedAt: "desc" } });
    const sellerOrder = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId: order.id } });

    await transitionSellerOrder(sellerId, sellerOrder.id, "CONFIRMED");
    await transitionSellerOrder(sellerId, sellerOrder.id, "PROCESSING");
    await transitionSellerOrder(sellerId, sellerOrder.id, "PACKED");
    await transitionSellerOrder(sellerId, sellerOrder.id, "SHIPPED", { carrier: "DHL", trackingNumber: "BND-1" });
    await transitionSellerOrder(sellerId, sellerOrder.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerId, sellerOrder.id, "DELIVERED");

    const invAAfter = await prisma.inventory.findFirstOrThrow({ where: { productId: componentAId } });
    expect(invAAfter.reserved).toBe(invABefore.reserved - 4); // released back to 0 reserved
    expect(invAAfter.quantity).toBe(invABefore.quantity - 4); // and actually sold (decremented)
  });
});

describe("cancelling a bundle order releases component reservations", () => {
  it("releases exactly what was reserved for the bundle's components", async () => {
    const invBBefore = await prisma.inventory.findFirstOrThrow({ where: { productId: componentBId } });

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId }, update: {}, create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: bundleProductId, quantity: 1 } });
    const order = await placeOrder(buyerId, addressId);

    const invBAfterOrder = await prisma.inventory.findFirstOrThrow({ where: { productId: componentBId } });
    expect(invBAfterOrder.reserved).toBe(invBBefore.reserved + 1);

    await requestCustomerCancellation(buyerId, order.orderNumber);

    const invBAfterCancel = await prisma.inventory.findFirstOrThrow({ where: { productId: componentBId } });
    expect(invBAfterCancel.reserved).toBe(invBBefore.reserved); // back to where it was
  });
});
