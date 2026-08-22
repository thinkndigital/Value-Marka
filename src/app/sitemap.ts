import type { MetadataRoute } from "next";
import { prisma } from "@/server/db";
import { routing } from "@/i18n/routing";

/**
 * Real URLs pulled straight from the database on every request — nothing
 * enumerated by hand — so a new product/store/page shows up here the
 * moment it goes ACTIVE/APPROVED/PUBLISHED, and a delisted one drops out,
 * with no separate step to keep in sync.
 */
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function localizedEntry(path: string, lastModified: Date): MetadataRoute.Sitemap[number] {
  const base = appUrl();
  return {
    url: `${base}/${routing.defaultLocale}${path}`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`])),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, sellers, pages, posts] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.seller.findMany({
      where: { status: "APPROVED" },
      select: { storeSlug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cmsPage.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return [
    localizedEntry("", new Date()),
    localizedEntry("/blog", new Date()),
    ...products.map((p) => localizedEntry(`/product/${p.slug}`, p.updatedAt)),
    ...sellers.map((s) => localizedEntry(`/store/${s.storeSlug}`, s.updatedAt)),
    ...pages.map((p) => localizedEntry(`/page/${p.slug}`, p.updatedAt)),
    ...posts.map((p) => localizedEntry(`/blog/${p.slug}`, p.updatedAt)),
  ];
}
