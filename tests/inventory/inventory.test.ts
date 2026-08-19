import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  InventoryError,
  recordInventoryMovementStandalone,
} from "@/server/services/inventory";

const PREFIX = "inventory-test-";

let sellerId: string;
let warehouseId: string;
let categoryId: string;
let productId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Inventory",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Inventory Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Test Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "INV-1",
      name: "Inventory Test Product",
      price: "10.00",
      costPrice: "5.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId } } });
  await prisma.inventory.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("recordInventoryMovementStandalone", () => {
  it("creates an Inventory row on the first movement and reuses it after", async () => {
    const first = await recordInventoryMovementStandalone({
      productId,
      warehouseId,
      type: "PURCHASE",
      quantity: 10,
      reason: "test purchase",
    });
    const second = await recordInventoryMovementStandalone({
      productId,
      warehouseId,
      type: "SALE",
      quantity: -3,
      reason: "test sale",
    });

    expect(second.id).toBe(first.id);
    expect(second.quantity).toBe(7);

    const rows = await prisma.inventory.findMany({ where: { productId, warehouseId } });
    expect(rows).toHaveLength(1);

    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryId: first.id },
      orderBy: { createdAt: "asc" },
    });
    expect(movements.map((m) => m.type)).toEqual(["PURCHASE", "SALE"]);
  });

  it("refuses to let quantity go negative", async () => {
    await expect(
      recordInventoryMovementStandalone({
        productId,
        warehouseId,
        type: "SALE",
        quantity: -1000,
        reason: "would go negative",
      }),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  it("tracks reservations separately from on-hand quantity", async () => {
    const inventory = await recordInventoryMovementStandalone({
      productId,
      warehouseId,
      type: "RESERVATION",
      quantity: 2,
      reason: "cart hold",
    });
    expect(inventory.reserved).toBe(2);
    expect(inventory.quantity).toBe(7); // unchanged from the previous test

    const released = await recordInventoryMovementStandalone({
      productId,
      warehouseId,
      type: "RELEASE",
      quantity: 2,
      reason: "cart expired",
    });
    expect(released.reserved).toBe(0);
  });

  it("refuses to release more than is reserved", async () => {
    await expect(
      recordInventoryMovementStandalone({
        productId,
        warehouseId,
        type: "RELEASE",
        quantity: 5,
        reason: "over-release",
      }),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  it("the database enforces one Inventory row per product+warehouse when there is no variant", async () => {
    // Bypasses the service layer's find-then-create logic to prove the
    // constraint holds at the database level, not just in application code
    // (see migration 20260819072807_inventory_partial_unique_no_variant).
    await expect(
      prisma.$executeRaw`INSERT INTO "Inventory" (id, "productId", "variantId", "warehouseId", quantity, reserved, damaged, "lowStockThreshold", "updatedAt")
        VALUES (gen_random_uuid(), ${productId}, NULL, ${warehouseId}, 0, 0, 0, 5, now())`,
    ).rejects.toThrow();
  });
});
