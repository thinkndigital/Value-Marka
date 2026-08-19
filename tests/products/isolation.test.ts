import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createProduct, getProductForSeller, updateProduct } from "@/server/services/products";
import { ForbiddenError } from "@/server/rbac";

// Product/seller isolation is the marketplace's core trust boundary
// (ARCHITECTURE.md §5) — verified here against the real database rather
// than mocked.

const PREFIX = "product-isolation-test-";

let sellerAId: string;
let sellerBId: string;
let warehouseAId: string;
let categoryId: string;
let productAId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}a-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "A",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}b-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "B",
        passwordHash: "unused",
      },
    }),
  ]);

  const [sellerA, sellerB] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: userA.id,
        storeSlug: `${PREFIX}store-a-${Date.now()}`,
        storeName: "Isolation Test Store A",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: userB.id,
        storeSlug: `${PREFIX}store-b-${Date.now()}`,
        storeName: "Isolation Test Store B",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;

  const warehouseA = await prisma.warehouse.create({
    data: { sellerId: sellerAId, name: "A Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseAId = warehouseA.id;

  const product = await createProduct(
    sellerAId,
    {
      name: "Isolation Test Product",
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "ISO-1",
      categoryId,
      brandId: undefined,
      shortDescription: undefined,
      description: undefined,
      price: "19.99",
      costPrice: "9.99",
      currencyCode: "USD",
    },
    { warehouseId: warehouseAId, initialQuantity: 5, images: [], actorId: userA.id },
  );
  productAId = product.id;
});

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({
    where: { inventory: { productId: productAId } },
  });
  await prisma.inventory.deleteMany({ where: { productId: productAId } });
  await prisma.productImage.deleteMany({ where: { productId: productAId } });
  await prisma.product.deleteMany({ where: { id: productAId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseAId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerAId, sellerBId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("product seller isolation", () => {
  it("lets a seller read their own product", async () => {
    const product = await getProductForSeller(sellerAId, productAId);
    expect(product.id).toBe(productAId);
  });

  it("blocks a different seller from reading the product", async () => {
    await expect(getProductForSeller(sellerBId, productAId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("blocks a different seller from updating the product", async () => {
    await expect(
      updateProduct(sellerBId, productAId, {
        name: "Hijacked",
        slug: "hijacked-slug",
        sku: "ISO-1",
        categoryId,
        brandId: undefined,
        shortDescription: undefined,
        description: undefined,
        price: "1.00",
        costPrice: "0.50",
        currencyCode: "USD",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const stillOwnedByA = await getProductForSeller(sellerAId, productAId);
    expect(stillOwnedByA.name).toBe("Isolation Test Product");
  });

  it("opening stock created a real inventory movement", async () => {
    const product = await getProductForSeller(sellerAId, productAId);
    const inventory = product.inventory[0];
    expect(inventory.quantity).toBe(5);

    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryId: inventory.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe("PURCHASE");
    expect(movements[0].quantity).toBe(5);
  });
});
