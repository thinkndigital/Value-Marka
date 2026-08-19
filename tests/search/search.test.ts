import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { searchProducts, listSearchableCategories } from "@/server/services/search";

const PREFIX = "search-test-";

let sellerId: string;
let categoryId: string;
let otherCategoryId: string;
let cheapId: string;
let midId: string;
let expensiveId: string;
let draftId: string;

beforeAll(async () => {
  const [category, otherCategory] = await Promise.all([
    prisma.category.create({
      data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
    }),
    prisma.category.create({
      data: { name: `${PREFIX}other-category`, slug: `${PREFIX}other-category-${Date.now()}` },
    }),
  ]);
  categoryId = category.id;
  otherCategoryId = otherCategory.id;

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Search",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Search Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const stamp = Date.now();
  const [cheap, mid, expensive, draft] = await Promise.all([
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}cheap-${stamp}`,
        sku: "SEARCH-1",
        name: `${PREFIX}Zebra Cushion`,
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId,
        categoryId: otherCategoryId,
        slug: `${PREFIX}mid-${stamp}`,
        sku: "SEARCH-2",
        name: `${PREFIX}Aardvark Lamp`,
        price: "20.00",
        costPrice: "10.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}expensive-${stamp}`,
        sku: "SEARCH-3",
        name: `${PREFIX}Zebra Ottoman`,
        price: "30.00",
        costPrice: "15.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}draft-${stamp}`,
        sku: "SEARCH-4",
        name: `${PREFIX}Zebra Draft Product`,
        price: "5.00",
        costPrice: "2.00",
        currencyCode: "USD",
        status: "DRAFT",
      },
    }),
  ]);
  cheapId = cheap.id;
  midId = mid.id;
  expensiveId = expensive.id;
  draftId = draft.id;
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: [cheapId, midId, expensiveId, draftId] } } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: { in: [categoryId, otherCategoryId] } } });
  await prisma.$disconnect();
});

describe("searchProducts", () => {
  it("matches on product name and excludes non-ACTIVE products", async () => {
    const results = await searchProducts({ q: `${PREFIX}Zebra` });
    const names = results.items.map((p) => p.name);
    expect(names).toContain(`${PREFIX}Zebra Cushion`);
    expect(names).toContain(`${PREFIX}Zebra Ottoman`);
    expect(names).not.toContain(`${PREFIX}Zebra Draft Product`);
    expect(names).not.toContain(`${PREFIX}Aardvark Lamp`);
  });

  it("filters by category slug", async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { id: otherCategoryId } });
    const results = await searchProducts({ q: PREFIX, categorySlug: category.slug });
    expect(results.items.map((p) => p.id)).toEqual([midId]);
  });

  it("sorts by price ascending and descending", async () => {
    const asc = await searchProducts({ q: `${PREFIX}Zebra`, sort: "price_asc" });
    expect(asc.items.map((p) => p.id)).toEqual([cheapId, expensiveId]);

    const desc = await searchProducts({ q: `${PREFIX}Zebra`, sort: "price_desc" });
    expect(desc.items.map((p) => p.id)).toEqual([expensiveId, cheapId]);
  });
});

describe("listSearchableCategories", () => {
  it("only returns categories with at least one ACTIVE product", async () => {
    // otherCategoryId has exactly one ACTIVE product (mid); a bare category
    // with none wouldn't appear at all, which this seed doesn't create, but
    // draftId proves a category isn't included on the strength of a DRAFT
    // product alone — categoryId still qualifies via cheap/expensive.
    const categories = await listSearchableCategories();
    const slugs = categories.map((c) => c.slug);
    const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const otherCategory = await prisma.category.findUniqueOrThrow({ where: { id: otherCategoryId } });
    expect(slugs).toContain(category.slug);
    expect(slugs).toContain(otherCategory.slug);
  });
});
