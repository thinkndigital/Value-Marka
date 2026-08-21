import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createBanner,
  listBannersForAdmin,
  updateBanner,
  toggleBannerActive,
  reorderBanner,
  deleteBanner,
  getHomepageBanners,
  CmsError,
} from "@/server/services/cms";

// Homepage banners are real CmsBlock rows (key "homepage.banner") — this
// exercises the admin CRUD plus the public read path's isActive filter.

const LOCALE = "cms-banner-test";

afterEach(async () => {
  await prisma.cmsBlock.deleteMany({ where: { key: "homepage.banner", locale: LOCALE } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("homepage banners", () => {
  it("creates banners with increasing sortOrder and lists them in order", async () => {
    const first = await createBanner(LOCALE, { headline: "First", href: "/a" });
    const second = await createBanner(LOCALE, { headline: "Second", href: "/b" });

    const banners = await listBannersForAdmin(LOCALE);
    expect(banners.map((b) => b.id)).toEqual([first.id, second.id]);
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
  });

  it("only surfaces active banners on the public read path", async () => {
    const active = await createBanner(LOCALE, { headline: "Active", href: "/a" });
    const hidden = await createBanner(LOCALE, { headline: "Hidden", href: "/b" });
    await toggleBannerActive(hidden.id);

    const publicBanners = await getHomepageBanners(LOCALE);
    const ids = publicBanners.map((b) => b.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(hidden.id);
  });

  it("updates banner content", async () => {
    const banner = await createBanner(LOCALE, { headline: "Old", href: "/old" });
    await updateBanner(banner.id, { headline: "New", href: "/new" });

    const [reloaded] = await listBannersForAdmin(LOCALE);
    expect((reloaded.content as { headline: string }).headline).toBe("New");
  });

  it("swaps sortOrder when reordering", async () => {
    const first = await createBanner(LOCALE, { headline: "A", href: "/a" });
    const second = await createBanner(LOCALE, { headline: "B", href: "/b" });

    await reorderBanner(second.id, "up");

    const banners = await listBannersForAdmin(LOCALE);
    expect(banners.map((b) => b.id)).toEqual([second.id, first.id]);
  });

  it("deletes a banner", async () => {
    const banner = await createBanner(LOCALE, { headline: "Gone", href: "/gone" });
    await deleteBanner(banner.id);

    const banners = await listBannersForAdmin(LOCALE);
    expect(banners.find((b) => b.id === banner.id)).toBeUndefined();
  });

  it("refuses to operate on a non-banner block", async () => {
    const heroBlock = await prisma.cmsBlock.create({
      data: { key: "homepage.hero", type: "hero", locale: LOCALE, content: {} },
    });
    await expect(updateBanner(heroBlock.id, { headline: "x", href: "/x" })).rejects.toBeInstanceOf(
      CmsError,
    );
    await prisma.cmsBlock.delete({ where: { id: heroBlock.id } });
  });
});
