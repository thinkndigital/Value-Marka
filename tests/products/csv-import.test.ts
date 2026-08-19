import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { importProductsCsv } from "@/server/services/product-csv";

const PREFIX = "csv-import-test-";

let sellerId: string;
let userId: string;
let warehouseId: string;
let categorySlug: string;

beforeAll(async () => {
  categorySlug = `${PREFIX}category-${Date.now()}`;
  await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: categorySlug },
  });

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Csv",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });
  userId = user.id;

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "CSV Import Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "CSV Test Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;
});

afterAll(async () => {
  const products = await prisma.product.findMany({ where: { sellerId }, select: { id: true } });
  const productIds = products.map((p) => p.id);
  await prisma.inventoryMovement.deleteMany({
    where: { inventory: { productId: { in: productIds } } },
  });
  await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { sellerId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
  await prisma.$disconnect();
});

describe("importProductsCsv", () => {
  it("imports valid rows and reports errors for invalid ones without aborting the batch", async () => {
    const csv = [
      "sku,name,slug,categorySlug,brandSlug,price,costPrice,currencyCode,weightGrams,shortDescription,stock",
      `CSV-1,Valid Product,${PREFIX}valid-${Date.now()},${categorySlug},,29.99,15.00,USD,500,A good product,12`,
      `CSV-2,Bad Category Product,${PREFIX}bad-cat-${Date.now()},nonexistent-category,,10.00,5.00,USD,,,3`,
      `CSV-3,Bad Price Product,${PREFIX}bad-price-${Date.now()},${categorySlug},,not-a-price,5.00,USD,,,1`,
    ].join("\n");

    const result = await importProductsCsv(sellerId, csv, warehouseId, userId);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4]);

    const created = await prisma.product.findUnique({
      where: { sellerId_sku: { sellerId, sku: "CSV-1" } },
      include: { inventory: true },
    });
    expect(created).not.toBeNull();
    expect(created?.inventory[0]?.quantity).toBe(12);
  });

  it("updates an existing product when the SKU already exists", async () => {
    const csv = [
      "sku,name,slug,categorySlug,brandSlug,price,costPrice,currencyCode,weightGrams,shortDescription,stock",
      `CSV-1,Updated Name,${PREFIX}valid-updated-${Date.now()},${categorySlug},,39.99,20.00,USD,500,Updated,0`,
    ].join("\n");

    const result = await importProductsCsv(sellerId, csv, warehouseId, userId);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);

    const updated = await prisma.product.findUnique({
      where: { sellerId_sku: { sellerId, sku: "CSV-1" } },
    });
    expect(updated?.name).toBe("Updated Name");
    expect(Number(updated?.price)).toBeCloseTo(39.99, 2);
  });
});
