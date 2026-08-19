import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resolveCommissionRate } from "@/server/services/commission";

// Resolution order (DATABASE.md §7): PRODUCT > SELLER_CATEGORY > SELLER >
// CATEGORY > GLOBAL, with Seller.commissionOverride folded in at the
// SELLER tier. Verified against the real database with real rows for every
// scope so a change in resolution order would actually fail this test.

const PREFIX = "commission-test-";

// overrideSellerId: has Seller.commissionOverride but no explicit rules —
// isolates the override-folding behavior.
// ruledSellerId: has explicit SELLER and SELLER_CATEGORY rules (and the
// PRODUCT rule, on productId) — isolates rule-vs-rule precedence.
// plainSellerId: has neither — isolates the CATEGORY/GLOBAL fallback.
let overrideSellerId: string;
let ruledSellerId: string;
let plainSellerId: string;
let categoryId: string;
let otherCategoryId: string;
let productId: string;
let ruleIds: string[] = [];

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

  const users = await Promise.all(
    ["override", "ruled", "plain"].map((tag) =>
      prisma.user.create({
        data: {
          email: `${PREFIX}${tag}-${Date.now()}@example.com`,
          firstName: "Commission",
          lastName: tag,
          passwordHash: "unused",
        },
      }),
    ),
  );

  const [overrideSeller, ruledSeller, plainSeller] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: users[0].id,
        storeSlug: `${PREFIX}override-store-${Date.now()}`,
        storeName: "Commission Test Override Store",
        countryCode: "JO",
        status: "APPROVED",
        commissionOverride: "0.05",
      },
    }),
    prisma.seller.create({
      data: {
        userId: users[1].id,
        storeSlug: `${PREFIX}ruled-store-${Date.now()}`,
        storeName: "Commission Test Ruled Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: users[2].id,
        storeSlug: `${PREFIX}plain-store-${Date.now()}`,
        storeName: "Commission Test Plain Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  overrideSellerId = overrideSeller.id;
  ruledSellerId = ruledSeller.id;
  plainSellerId = plainSeller.id;

  const product = await prisma.product.create({
    data: {
      sellerId: ruledSellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "COMM-1",
      name: "Commission Test Product",
      price: "10.00",
      costPrice: "5.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;

  const rules = await prisma.$transaction([
    prisma.commissionRule.create({ data: { scope: "GLOBAL", rate: "0.20" } }),
    prisma.commissionRule.create({ data: { scope: "CATEGORY", categoryId, rate: "0.15" } }),
    prisma.commissionRule.create({ data: { scope: "SELLER", sellerId: ruledSellerId, rate: "0.10" } }),
    prisma.commissionRule.create({
      data: { scope: "SELLER_CATEGORY", sellerId: ruledSellerId, categoryId, rate: "0.08" },
    }),
    prisma.commissionRule.create({ data: { scope: "PRODUCT", productId, rate: "0.03" } }),
  ]);
  ruleIds = rules.map((r) => r.id);
});

afterAll(async () => {
  await prisma.commissionRule.deleteMany({ where: { id: { in: ruleIds } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.seller.deleteMany({
    where: { id: { in: [overrideSellerId, ruledSellerId, plainSellerId] } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: { in: [categoryId, otherCategoryId] } } });
  await prisma.$disconnect();
});

describe("resolveCommissionRate", () => {
  it("a PRODUCT rule wins over everything else, including this same seller's own SELLER/SELLER_CATEGORY rules", async () => {
    const rate = await resolveCommissionRate(ruledSellerId, categoryId, productId);
    expect(rate).toBe(0.03);
  });

  it("SELLER_CATEGORY beats SELLER for a different product in the ruled category", async () => {
    const otherProduct = await prisma.product.create({
      data: {
        sellerId: ruledSellerId,
        categoryId,
        slug: `${PREFIX}product2-${Date.now()}`,
        sku: "COMM-2",
        name: "Commission Test Product 2",
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });
    const rate = await resolveCommissionRate(ruledSellerId, categoryId, otherProduct.id);
    expect(rate).toBe(0.08);
    await prisma.product.delete({ where: { id: otherProduct.id } });
  });

  it("SELLER beats CATEGORY outside the seller's SELLER_CATEGORY scope", async () => {
    const rate = await resolveCommissionRate(ruledSellerId, otherCategoryId, "nonexistent-product-id");
    expect(rate).toBe(0.1);
  });

  it("falls back to CATEGORY for a seller with no override and no explicit rule", async () => {
    const rate = await resolveCommissionRate(plainSellerId, categoryId, "nonexistent-product-id");
    expect(rate).toBe(0.15);
  });

  it("falls back to GLOBAL when nothing matches this seller or category", async () => {
    const rate = await resolveCommissionRate(plainSellerId, otherCategoryId, "nonexistent-product-id");
    expect(rate).toBe(0.2);
  });

  it("Seller.commissionOverride is folded in at the SELLER tier, beating CATEGORY and GLOBAL", async () => {
    const rate = await resolveCommissionRate(overrideSellerId, otherCategoryId, "nonexistent-product-id");
    expect(rate).toBe(0.05);
  });
});
