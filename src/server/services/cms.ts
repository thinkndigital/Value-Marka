import "server-only";
import { prisma } from "@/server/db";

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

/**
 * Homepage content lives in CmsBlock rows, not hardcoded JSX (spec §41,
 * IMPLEMENTATION_PLAN.md Phase 3). Until Phase 8 ships an admin builder,
 * these rows are managed via prisma/seed.ts — still a real data source,
 * never a component literal.
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

export async function getFeaturedCategories(locale: string) {
  const limit = await getBlockLimit("homepage.featured_categories", locale, 8);
  return prisma.category.findMany({
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
