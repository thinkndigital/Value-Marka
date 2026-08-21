import "server-only";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { resolveTranslationsFor } from "@/server/services/translations";

export class CmsError extends Error {}

interface HeroContent {
  kicker: string;
  title: string;
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
}

interface LimitContent {
  limit: number;
}

export interface BannerContent {
  headline: string;
  subheadline?: string;
  imageUrl?: string;
  href: string;
}

/**
 * Homepage content lives in CmsBlock rows, not hardcoded JSX (spec §41,
 * IMPLEMENTATION_PLAN.md Phase 3). As of Phase 8 these rows are editable
 * from /admin/cms/homepage; prisma/seed.ts still seeds the initial rows so
 * a fresh database has real content on first boot.
 */
export async function getHomepageHero(locale: string): Promise<HeroContent | null> {
  const block = await prisma.cmsBlock.findFirst({
    where: { key: "homepage.hero", locale, isActive: true },
  });
  return (block?.content as unknown as HeroContent) ?? null;
}

async function getBlockLimit(key: string, locale: string, fallback: number): Promise<number> {
  const block = await prisma.cmsBlock.findFirst({ where: { key, locale, isActive: true } });
  const content = block?.content as unknown as LimitContent | undefined;
  return content?.limit ?? fallback;
}

/**
 * Category names are stored once, in whichever language they were entered
 * (spec limitation: Category.name is a single column, not per-locale). An
 * admin-managed Translation row overrides the display name for a given
 * locale — resolved here in one batched query rather than per-category, so
 * the read path this Phase 8 admin UI feeds into is real, not decorative.
 */
export async function getFeaturedCategories(locale: string) {
  const limit = await getBlockLimit("homepage.featured_categories", locale, 8);
  const categories = await prisma.category.findMany({
    where: { isActive: true, products: { some: { status: "ACTIVE" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });

  const overrides = await resolveTranslationsFor(
    "Category",
    categories.map((c) => c.id),
    "name",
    locale,
  );
  return categories.map((category) => ({ ...category, name: overrides.get(category.id) ?? category.name }));
}

export async function getNewArrivals(locale: string) {
  const limit = await getBlockLimit("homepage.featured_products", locale, 8);
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      seller: { select: { storeName: true, storeSlug: true } },
    },
  });
}

export async function getHomepageBanners(locale: string) {
  const blocks = await prisma.cmsBlock.findMany({
    where: { key: "homepage.banner", locale, isActive: true, pageId: null },
    orderBy: { sortOrder: "asc" },
  });
  return blocks.map((block) => ({ id: block.id, ...(block.content as unknown as BannerContent) }));
}

// ── Admin: homepage builder ─────────────────────────────────────────────

/** Unlike getHomepageHero, this ignores isActive so the admin form can prefill a disabled block too. */
export async function getHeroBlockRaw(locale: string): Promise<HeroContent | null> {
  const block = await prisma.cmsBlock.findFirst({ where: { key: "homepage.hero", locale, pageId: null } });
  return (block?.content as unknown as HeroContent) ?? null;
}

export async function getLimitBlockRaw(
  key: "homepage.featured_categories" | "homepage.featured_products",
  locale: string,
): Promise<number | null> {
  const block = await prisma.cmsBlock.findFirst({ where: { key, locale, pageId: null } });
  const content = block?.content as unknown as LimitContent | undefined;
  return content?.limit ?? null;
}

export async function upsertHeroContent(locale: string, content: HeroContent) {
  const existing = await prisma.cmsBlock.findFirst({
    where: { key: "homepage.hero", locale, pageId: null },
  });
  if (existing) {
    return prisma.cmsBlock.update({
      where: { id: existing.id },
      data: { content: content as unknown as Prisma.InputJsonValue },
    });
  }
  return prisma.cmsBlock.create({
    data: { key: "homepage.hero", type: "hero", locale, content: content as unknown as Prisma.InputJsonValue },
  });
}

export async function upsertLimitBlock(
  key: "homepage.featured_categories" | "homepage.featured_products",
  locale: string,
  limit: number,
) {
  const existing = await prisma.cmsBlock.findFirst({ where: { key, locale, pageId: null } });
  const content: Prisma.InputJsonValue = { limit };
  if (existing) {
    return prisma.cmsBlock.update({ where: { id: existing.id }, data: { content } });
  }
  return prisma.cmsBlock.create({ data: { key, type: "limit", locale, content } });
}

export function listBannersForAdmin(locale: string) {
  return prisma.cmsBlock.findMany({
    where: { key: "homepage.banner", locale, pageId: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createBanner(locale: string, content: BannerContent) {
  const last = await prisma.cmsBlock.findFirst({
    where: { key: "homepage.banner", locale, pageId: null },
    orderBy: { sortOrder: "desc" },
  });
  return prisma.cmsBlock.create({
    data: {
      key: "homepage.banner",
      type: "banner",
      locale,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

async function getOwnedBanner(id: string) {
  const block = await prisma.cmsBlock.findUnique({ where: { id } });
  if (!block || block.key !== "homepage.banner") throw new CmsError("Banner not found.");
  return block;
}

export async function updateBanner(id: string, content: BannerContent) {
  await getOwnedBanner(id);
  return prisma.cmsBlock.update({
    where: { id },
    data: { content: content as unknown as Prisma.InputJsonValue },
  });
}

export async function toggleBannerActive(id: string) {
  const block = await getOwnedBanner(id);
  return prisma.cmsBlock.update({ where: { id }, data: { isActive: !block.isActive } });
}

export async function reorderBanner(id: string, direction: "up" | "down") {
  const block = await getOwnedBanner(id);
  const neighbor = await prisma.cmsBlock.findFirst({
    where: {
      key: "homepage.banner",
      locale: block.locale,
      pageId: null,
      sortOrder: direction === "up" ? { lt: block.sortOrder } : { gt: block.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return block;

  await prisma.$transaction([
    prisma.cmsBlock.update({ where: { id: block.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.cmsBlock.update({ where: { id: neighbor.id }, data: { sortOrder: block.sortOrder } }),
  ]);
  return block;
}

export async function deleteBanner(id: string) {
  await getOwnedBanner(id);
  await prisma.cmsBlock.delete({ where: { id } });
}

// ── Admin: landing pages (CmsPage) ──────────────────────────────────────

export interface PageInput {
  slug: string;
  seoTitle?: string;
  seoDescription?: string;
  locale: string;
  body: string;
}

export function listCmsPages() {
  return prisma.cmsPage.findMany({ orderBy: { updatedAt: "desc" } });
}

/** Prefers the requested locale's body block, falling back to any locale the page has content in. */
async function getCmsPageBody(pageId: string, locale: string): Promise<string> {
  const block =
    (await prisma.cmsBlock.findFirst({ where: { pageId, key: "page.body", locale } })) ??
    (await prisma.cmsBlock.findFirst({ where: { pageId, key: "page.body" }, orderBy: { locale: "asc" } }));
  return (block?.content as unknown as { body?: string } | undefined)?.body ?? "";
}

export async function getCmsPageForAdmin(id: string, locale: string) {
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) return null;
  const body = await getCmsPageBody(page.id, locale);
  return { ...page, body };
}

export async function getPublishedCmsPage(slug: string, locale: string) {
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page || page.status !== "PUBLISHED") return null;
  const body = await getCmsPageBody(page.id, locale);
  return { ...page, body };
}

export async function createCmsPage(input: PageInput) {
  const existing = await prisma.cmsPage.findUnique({ where: { slug: input.slug } });
  if (existing) throw new CmsError("A page with this slug already exists.");

  return prisma.$transaction(async (tx) => {
    const page = await tx.cmsPage.create({
      data: {
        slug: input.slug,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        status: "DRAFT",
      },
    });
    await tx.cmsBlock.create({
      data: {
        pageId: page.id,
        key: "page.body",
        type: "richtext",
        locale: input.locale,
        content: { body: input.body } as unknown as Prisma.InputJsonValue,
      },
    });
    return page;
  });
}

export async function updateCmsPage(id: string, input: Omit<PageInput, "slug">) {
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) throw new CmsError("Page not found.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cmsPage.update({
      where: { id },
      data: { seoTitle: input.seoTitle, seoDescription: input.seoDescription },
    });
    const existingBlock = await tx.cmsBlock.findFirst({
      where: { pageId: id, key: "page.body", locale: input.locale },
    });
    const content = { body: input.body } as unknown as Prisma.InputJsonValue;
    if (existingBlock) {
      await tx.cmsBlock.update({ where: { id: existingBlock.id }, data: { content } });
    } else {
      await tx.cmsBlock.create({
        data: { pageId: id, key: "page.body", type: "richtext", locale: input.locale, content },
      });
    }
    return updated;
  });
}

export async function setCmsPageStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) throw new CmsError("Page not found.");
  return prisma.cmsPage.update({ where: { id }, data: { status } });
}

export async function deleteCmsPage(id: string) {
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) throw new CmsError("Page not found.");
  await prisma.cmsPage.delete({ where: { id } });
}
