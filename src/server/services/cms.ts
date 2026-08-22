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

// ── Admin: announcement bar ──────────────────────────────────────────────
// One row per announcement, holding both languages in its content (unlike
// hero/banner, which partition by CmsBlock.locale) — the admin form is
// explicitly "Arabic text + English text" together, not a per-locale
// editor. `locale` is fixed to a nominal constant purely so this reuses
// the same key/locale index the rest of CmsBlock already has.

const ANNOUNCEMENT_KEY = "site.announcement";
const ANNOUNCEMENT_LOCALE = "en";

export interface AnnouncementContent {
  textEn: string;
  textAr: string;
  link?: string;
  startDate?: string; // ISO date, inclusive
  endDate?: string; // ISO date, inclusive
}

export function listAnnouncementsForAdmin() {
  return prisma.cmsBlock.findMany({
    where: { key: ANNOUNCEMENT_KEY, locale: ANNOUNCEMENT_LOCALE, pageId: null },
    orderBy: { sortOrder: "asc" },
  });
}

/** The single highest-priority (lowest sortOrder) announcement that's enabled and within its date range right now — real logic, not a placeholder. */
export async function getActiveAnnouncement(locale: string, now: Date = new Date()) {
  const blocks = await prisma.cmsBlock.findMany({
    where: { key: ANNOUNCEMENT_KEY, locale: ANNOUNCEMENT_LOCALE, isActive: true, pageId: null },
    orderBy: { sortOrder: "asc" },
  });

  const active = blocks.find((block) => {
    const content = block.content as unknown as AnnouncementContent;
    if (content.startDate && new Date(content.startDate) > now) return false;
    if (content.endDate && new Date(content.endDate) < now) return false;
    return true;
  });
  if (!active) return null;

  const content = active.content as unknown as AnnouncementContent;
  return {
    id: active.id,
    text: locale === "ar" ? content.textAr : content.textEn,
    link: content.link,
  };
}

export async function createAnnouncement(content: AnnouncementContent) {
  const last = await prisma.cmsBlock.findFirst({
    where: { key: ANNOUNCEMENT_KEY, locale: ANNOUNCEMENT_LOCALE, pageId: null },
    orderBy: { sortOrder: "desc" },
  });
  return prisma.cmsBlock.create({
    data: {
      key: ANNOUNCEMENT_KEY,
      type: "announcement",
      locale: ANNOUNCEMENT_LOCALE,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

async function getOwnedAnnouncement(id: string) {
  const block = await prisma.cmsBlock.findUnique({ where: { id } });
  if (!block || block.key !== ANNOUNCEMENT_KEY) throw new CmsError("Announcement not found.");
  return block;
}

export async function updateAnnouncement(id: string, content: AnnouncementContent) {
  await getOwnedAnnouncement(id);
  return prisma.cmsBlock.update({
    where: { id },
    data: { content: content as unknown as Prisma.InputJsonValue },
  });
}

export async function toggleAnnouncementActive(id: string) {
  const block = await getOwnedAnnouncement(id);
  return prisma.cmsBlock.update({ where: { id }, data: { isActive: !block.isActive } });
}

export async function reorderAnnouncement(id: string, direction: "up" | "down") {
  const block = await getOwnedAnnouncement(id);
  const neighbor = await prisma.cmsBlock.findFirst({
    where: {
      key: ANNOUNCEMENT_KEY,
      locale: ANNOUNCEMENT_LOCALE,
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

export async function deleteAnnouncement(id: string) {
  await getOwnedAnnouncement(id);
  await prisma.cmsBlock.delete({ where: { id } });
}

// ── Admin: popups ─────────────────────────────────────────────────────
// Same CmsBlock-reuse pattern as the announcement bar above: one row per
// popup holding both languages, `locale` fixed to a nominal constant, and
// sortOrder doubling as priority. To stay non-intrusive only the single
// highest-priority match is ever returned — never more than one popup at
// once — and the storefront additionally remembers a dismissal per
// browser session (client-side), so a visitor never sees the same popup
// twice in one visit.

const POPUP_KEY = "site.popup";
const POPUP_LOCALE = "en";
export type PopupTarget = "ALL" | "GUEST" | "CUSTOMER";

export interface PopupContent {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  imageUrl?: string;
  ctaLabelEn?: string;
  ctaLabelAr?: string;
  ctaHref?: string;
  target: PopupTarget;
  startDate?: string; // ISO date, inclusive
  endDate?: string; // ISO date, inclusive
}

export function listPopupsForAdmin() {
  return prisma.cmsBlock.findMany({
    where: { key: POPUP_KEY, locale: POPUP_LOCALE, pageId: null },
    orderBy: { sortOrder: "asc" },
  });
}

/** The single highest-priority popup that's enabled, in its date range, and matches the visitor's audience right now. */
export async function getActivePopup(locale: string, isLoggedIn: boolean, now: Date = new Date()) {
  const blocks = await prisma.cmsBlock.findMany({
    where: { key: POPUP_KEY, locale: POPUP_LOCALE, isActive: true, pageId: null },
    orderBy: { sortOrder: "asc" },
  });

  const audience: PopupTarget = isLoggedIn ? "CUSTOMER" : "GUEST";
  const active = blocks.find((block) => {
    const content = block.content as unknown as PopupContent;
    if (content.target !== "ALL" && content.target !== audience) return false;
    if (content.startDate && new Date(content.startDate) > now) return false;
    if (content.endDate && new Date(content.endDate) < now) return false;
    return true;
  });
  if (!active) return null;

  const content = active.content as unknown as PopupContent;
  return {
    id: active.id,
    title: locale === "ar" ? content.titleAr : content.titleEn,
    body: locale === "ar" ? content.bodyAr : content.bodyEn,
    imageUrl: content.imageUrl,
    ctaLabel: locale === "ar" ? content.ctaLabelAr : content.ctaLabelEn,
    ctaHref: content.ctaHref,
  };
}

export async function createPopup(content: PopupContent) {
  const last = await prisma.cmsBlock.findFirst({
    where: { key: POPUP_KEY, locale: POPUP_LOCALE, pageId: null },
    orderBy: { sortOrder: "desc" },
  });
  return prisma.cmsBlock.create({
    data: {
      key: POPUP_KEY,
      type: "popup",
      locale: POPUP_LOCALE,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

async function getOwnedPopup(id: string) {
  const block = await prisma.cmsBlock.findUnique({ where: { id } });
  if (!block || block.key !== POPUP_KEY) throw new CmsError("Popup not found.");
  return block;
}

export async function updatePopup(id: string, content: PopupContent) {
  await getOwnedPopup(id);
  return prisma.cmsBlock.update({
    where: { id },
    data: { content: content as unknown as Prisma.InputJsonValue },
  });
}

export async function togglePopupActive(id: string) {
  const block = await getOwnedPopup(id);
  return prisma.cmsBlock.update({ where: { id }, data: { isActive: !block.isActive } });
}

export async function reorderPopup(id: string, direction: "up" | "down") {
  const block = await getOwnedPopup(id);
  const neighbor = await prisma.cmsBlock.findFirst({
    where: {
      key: POPUP_KEY,
      locale: POPUP_LOCALE,
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

export async function deletePopup(id: string) {
  await getOwnedPopup(id);
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
