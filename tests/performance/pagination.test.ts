import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { parsePage, paginate } from "@/server/pagination";
import { listProductsForSeller } from "@/server/services/products";

describe("pagination helpers", () => {
  it("parsePage defaults to 1 for missing/invalid/non-positive input", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("3.5")).toBe(1);
  });

  it("parsePage accepts a valid positive integer string", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("42")).toBe(42);
  });

  it("paginate computes totalPages, rounding up", () => {
    const result = paginate(["a", "b"], 25, 1, 10);
    expect(result).toEqual({ items: ["a", "b"], page: 1, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("paginate always reports at least 1 total page, even for zero results", () => {
    const result = paginate([], 0, 1, 10);
    expect(result.totalPages).toBe(1);
  });
});

const PREFIX = "pagination-test-";

let sellerId: string;
let categoryId: string;
const productIds: string[] = [];

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}seller-${Date.now()}@example.com`,
      firstName: "Pagination",
      lastName: "Seller",
      passwordHash: "unused",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Pagination Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  for (let i = 0; i < 7; i++) {
    const product = await prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}product-${i}-${Date.now()}`,
        sku: `PAGE-${i}`,
        name: `Pagination Product ${i}`,
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });
    productIds.push(product.id);
  }
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("listProductsForSeller pagination", () => {
  it("returns pageSize items per page and the right total/totalPages", async () => {
    const page1 = await listProductsForSeller(sellerId, 1, 3);
    expect(page1.items).toHaveLength(3);
    expect(page1.total).toBe(7);
    expect(page1.totalPages).toBe(3);

    const page2 = await listProductsForSeller(sellerId, 2, 3);
    expect(page2.items).toHaveLength(3);

    const page3 = await listProductsForSeller(sellerId, 3, 3);
    expect(page3.items).toHaveLength(1);
  });

  it("returns disjoint items across pages, covering every product exactly once", async () => {
    const page1 = await listProductsForSeller(sellerId, 1, 3);
    const page2 = await listProductsForSeller(sellerId, 2, 3);
    const page3 = await listProductsForSeller(sellerId, 3, 3);

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((p) => p.id);
    expect(new Set(allIds).size).toBe(7);
    expect(allIds.sort()).toEqual([...productIds].sort());
  });

  it("returns an empty page past the end without erroring", async () => {
    const page = await listProductsForSeller(sellerId, 10, 3);
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(7);
  });
});
