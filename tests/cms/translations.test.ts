import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  upsertTranslation,
  resolveTranslationsFor,
  deleteTranslation,
  listTranslations,
  TranslationError,
} from "@/server/services/translations";
import { getFeaturedCategories } from "@/server/services/cms";

const PREFIX = "translation-test-";

let categoryId: string;
let sellerId: string;

afterAll(async () => {
  await prisma.translation.deleteMany({ where: { entityType: "Category", entityId: categoryId } });
  await prisma.product.deleteMany({ where: { categoryId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("translations", () => {
  it("upserts a translation (create then update in place)", async () => {
    const category = await prisma.category.create({
      data: { name: `${PREFIX}base`, slug: `${PREFIX}base-${Date.now()}` },
    });
    categoryId = category.id;

    const created = await upsertTranslation({
      entityType: "Category",
      entityId: category.id,
      locale: "ar",
      field: "name",
      value: "الأول",
    });
    const updated = await upsertTranslation({
      entityType: "Category",
      entityId: category.id,
      locale: "ar",
      field: "name",
      value: "الثاني",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.value).toBe("الثاني");

    const rows = await listTranslations("Category");
    expect(rows.filter((r) => r.entityId === category.id)).toHaveLength(1);
  });

  it("batch-resolves translations for multiple entities, omitting ones with no override", async () => {
    const other = await prisma.category.create({
      data: { name: `${PREFIX}no-override`, slug: `${PREFIX}no-override-${Date.now()}` },
    });

    const map = await resolveTranslationsFor("Category", [categoryId, other.id], "name", "ar");
    expect(map.get(categoryId)).toBe("الثاني");
    expect(map.has(other.id)).toBe(false);

    await prisma.category.delete({ where: { id: other.id } });
  });

  it("feeds getFeaturedCategories: an Arabic override wins, English falls back to the base name", async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "T",
        lastName: "Seller",
        passwordHash: "unused",
      },
    });
    const seller = await prisma.seller.create({
      data: {
        userId: user.id,
        storeSlug: `${PREFIX}store-${Date.now()}`,
        storeName: "Translation Test Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    });
    sellerId = seller.id;
    await prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}product-${Date.now()}`,
        sku: "TRN-1",
        name: "Translation Test Product",
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });

    const arCategories = await getFeaturedCategories("ar");
    const enCategories = await getFeaturedCategories("en");

    expect(arCategories.find((c) => c.id === categoryId)?.name).toBe("الثاني");
    expect(enCategories.find((c) => c.id === categoryId)?.name).toBe(`${PREFIX}base`);
  });

  it("deletes a translation", async () => {
    const rows = await listTranslations("Category");
    const row = rows.find((r) => r.entityId === categoryId);
    if (!row) throw new Error("expected translation row to exist");

    await deleteTranslation(row.id);

    const map = await resolveTranslationsFor("Category", [categoryId], "name", "ar");
    expect(map.has(categoryId)).toBe(false);
  });

  it("refuses to delete a translation that doesn't exist", async () => {
    await expect(deleteTranslation("not-a-real-id")).rejects.toBeInstanceOf(TranslationError);
  });
});
