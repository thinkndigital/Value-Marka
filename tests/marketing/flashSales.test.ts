import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as flashSales from "@/server/services/flashSales";
import { FlashSaleError } from "@/server/services/flashSales";
import { placeOrder, CheckoutError } from "@/server/services/checkout";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";

const PREFIX = "flash-sale-test-";

let categoryId: string;
let sellerId: string;
let warehouseId: string;
let productId: string;
let buyerId: string;
let addressId: string;
const createdSaleIds: string[] = [];

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [sellerUser, buyer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "Flash",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Flash",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Flash Sale Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Flash Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "FLASH-1",
      name: "Flash Sale Test Product",
      price: "100.00",
      costPrice: "50.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;

  await recordInventoryMovementStandalone({
    productId,
    warehouseId,
    type: "PURCHASE",
    quantity: 50,
    reason: "test opening stock",
  });

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Flash Buyer",
      phone: "+962700000001",
      countryCode: "JO",
      city: "Amman",
      addressLine1: "1 Flash Street",
      isDefault: true,
    },
  });
  addressId = address.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { productId } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  await prisma.flashSaleItem.deleteMany({ where: { flashSaleId: { in: createdSaleIds } } });
  await prisma.flashSale.deleteMany({ where: { id: { in: createdSaleIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId } } });
  await prisma.inventory.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

// Every test shares one product, so a sale left active from an earlier test
// would otherwise leak into "active items for this product" lookups in
// later tests — deactivate everything created so far after each test.
afterEach(async () => {
  if (createdSaleIds.length === 0) return;
  await prisma.flashSale.updateMany({
    where: { id: { in: createdSaleIds } },
    data: { isActive: false },
  });
});

async function createSale(overrides: Partial<{ startsAt: Date; endsAt: Date; isActive: boolean }> = {}) {
  const sale = await flashSales.createFlashSale({
    name: `${PREFIX}sale`,
    startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000),
    endsAt: overrides.endsAt ?? new Date(Date.now() + 60 * 60_000),
  });
  createdSaleIds.push(sale.id);
  if (overrides.isActive === false) {
    await flashSales.toggleFlashSaleActive(sale.id);
  }
  return sale;
}

describe("flash sale admin CRUD", () => {
  it("creates, updates, toggles, and deletes a flash sale", async () => {
    const sale = await createSale();
    expect(sale.isActive).toBe(true);

    const updated = await flashSales.updateFlashSale(sale.id, {
      name: `${PREFIX}renamed`,
      startsAt: sale.startsAt,
      endsAt: sale.endsAt,
    });
    expect(updated.name).toBe(`${PREFIX}renamed`);

    const toggled = await flashSales.toggleFlashSaleActive(sale.id);
    expect(toggled.isActive).toBe(false);

    await flashSales.deleteFlashSale(sale.id);
    createdSaleIds.splice(createdSaleIds.indexOf(sale.id), 1);
    await expect(flashSales.getFlashSale(sale.id)).rejects.toBeInstanceOf(FlashSaleError);
  });

  it("rejects operating on an unknown flash sale", async () => {
    await expect(
      flashSales.updateFlashSale("00000000-0000-0000-0000-000000000000", {
        name: "x",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toBeInstanceOf(FlashSaleError);
  });

  it("adds, updates, and removes a flash sale item, refusing duplicates", async () => {
    const sale = await createSale();

    const item = await flashSales.addFlashSaleItem(sale.id, {
      productId,
      discountPercent: 20,
      stockLimit: 10,
    });
    expect(Number(item.discountPercent)).toBe(20);

    await expect(
      flashSales.addFlashSaleItem(sale.id, { productId, discountPercent: 10, stockLimit: null }),
    ).rejects.toBeInstanceOf(FlashSaleError);

    const updated = await flashSales.updateFlashSaleItem(item.id, {
      discountPercent: 30,
      stockLimit: 5,
    });
    expect(Number(updated.discountPercent)).toBe(30);

    await flashSales.removeFlashSaleItem(item.id);
    await expect(flashSales.updateFlashSaleItem(item.id, { discountPercent: 1, stockLimit: null })).rejects.toBeInstanceOf(
      FlashSaleError,
    );
  });
});

describe("getActiveFlashSaleItemsForProducts", () => {
  it("only returns items whose sale is active and inside its date window", async () => {
    const past = await createSale({
      startsAt: new Date(Date.now() - 2 * 3600_000),
      endsAt: new Date(Date.now() - 3600_000),
    });
    await flashSales.addFlashSaleItem(past.id, { productId, discountPercent: 50, stockLimit: null });

    const future = await createSale({
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 2 * 3600_000),
    });
    await flashSales.addFlashSaleItem(future.id, { productId, discountPercent: 50, stockLimit: null });

    const disabled = await createSale({ isActive: false });
    await flashSales.addFlashSaleItem(disabled.id, { productId, discountPercent: 50, stockLimit: null });

    const map = await flashSales.getActiveFlashSaleItemsForProducts([productId]);
    expect(map.has(productId)).toBe(false);
  });

  it("picks the deepest discount when a product is enrolled in more than one active sale", async () => {
    const saleA = await createSale();
    await flashSales.addFlashSaleItem(saleA.id, { productId, discountPercent: 15, stockLimit: null });
    const saleB = await createSale();
    await flashSales.addFlashSaleItem(saleB.id, { productId, discountPercent: 40, stockLimit: null });

    const map = await flashSales.getActiveFlashSaleItemsForProducts([productId]);
    expect(map.get(productId)?.discountPercent).toBe(40);
  });

  it("excludes an item once its stock limit is reached", async () => {
    const sale = await createSale();
    const item = await flashSales.addFlashSaleItem(sale.id, {
      productId,
      discountPercent: 25,
      stockLimit: 2,
    });

    await flashSales.claimFlashSaleStock(prisma, item.id, 2);

    const map = await flashSales.getActiveFlashSaleItemsForProducts([productId]);
    expect(map.has(productId)).toBe(false);
  });
});

describe("computeEffectivePrice", () => {
  it("applies the discount percentage and rounds to cents", () => {
    expect(flashSales.computeEffectivePrice(100, 25)).toBe(75);
    expect(flashSales.computeEffectivePrice(19.99, 10)).toBe(17.99);
  });
});

describe("claimFlashSaleStock", () => {
  it("increments soldCount and refuses a claim that would exceed stockLimit", async () => {
    const sale = await createSale();
    const item = await flashSales.addFlashSaleItem(sale.id, {
      productId,
      discountPercent: 10,
      stockLimit: 3,
    });

    await flashSales.claimFlashSaleStock(prisma, item.id, 2);
    let row = await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.soldCount).toBe(2);

    await expect(flashSales.claimFlashSaleStock(prisma, item.id, 2)).rejects.toBeInstanceOf(FlashSaleError);
    row = await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.soldCount).toBe(2); // unchanged by the rejected claim
  });

  it("never blocks a claim when stockLimit is unlimited", async () => {
    const sale = await createSale();
    const item = await flashSales.addFlashSaleItem(sale.id, {
      productId,
      discountPercent: 10,
      stockLimit: null,
    });

    await flashSales.claimFlashSaleStock(prisma, item.id, 1000);
    const row = await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.soldCount).toBe(1000);
  });
});

describe("placeOrder with an active flash sale", () => {
  it("charges the discounted price, records it on the OrderItem, and claims flash stock", async () => {
    const sale = await createSale();
    const item = await flashSales.addFlashSaleItem(sale.id, {
      productId,
      discountPercent: 20,
      stockLimit: 5,
    });

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 2 } });

    const order = await placeOrder(buyerId, addressId);
    expect(order.subtotal.toString()).toBe("160"); // 2 × (100 × 0.8)

    const orderItem = await prisma.orderItem.findFirstOrThrow({
      where: { productId, sellerOrder: { orderId: order.id } },
    });
    expect(orderItem.unitPrice.toString()).toBe("80");
    expect(orderItem.lineTotal.toString()).toBe("160");

    const row = await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.soldCount).toBe(2);
  });

  it("rejects checkout when the order would oversell the flash sale's limited stock", async () => {
    const sale = await createSale();
    await flashSales.addFlashSaleItem(sale.id, { productId, discountPercent: 20, stockLimit: 1 });

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 2 } });

    await expect(placeOrder(buyerId, addressId)).rejects.toBeInstanceOf(CheckoutError);

    const ordersAfter = await prisma.order.count({ where: { userId: buyerId } });
    expect(ordersAfter).toBe(1); // only the prior successful order exists

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  });
});
