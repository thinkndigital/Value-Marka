import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createCmsPage,
  updateCmsPage,
  setCmsPageStatus,
  deleteCmsPage,
  getPublishedCmsPage,
  getCmsPageForAdmin,
  CmsError,
} from "@/server/services/cms";

const PREFIX = "cms-page-test-";
const createdSlugs: string[] = [];

afterAll(async () => {
  await prisma.cmsPage.deleteMany({ where: { slug: { in: createdSlugs } } });
  await prisma.$disconnect();
});

describe("CmsPage", () => {
  it("is not visible on the public read path until published", async () => {
    const slug = `${PREFIX}draft-${Date.now()}`;
    createdSlugs.push(slug);
    await createCmsPage({ slug, locale: "en", body: "Draft body." });

    const draftView = await getPublishedCmsPage(slug, "en");
    expect(draftView).toBeNull();
  });

  it("becomes visible after publishing, with the right body and SEO fields", async () => {
    const slug = `${PREFIX}publish-${Date.now()}`;
    createdSlugs.push(slug);
    const page = await createCmsPage({
      slug,
      locale: "en",
      body: "Published body.",
      seoTitle: "SEO Title",
      seoDescription: "SEO description.",
    });

    await setCmsPageStatus(page.id, "PUBLISHED");

    const published = await getPublishedCmsPage(slug, "en");
    expect(published?.body).toBe("Published body.");
    expect(published?.seoTitle).toBe("SEO Title");
    expect(published?.seoDescription).toBe("SEO description.");
  });

  it("goes invisible again after unpublishing", async () => {
    const slug = `${PREFIX}unpublish-${Date.now()}`;
    createdSlugs.push(slug);
    const page = await createCmsPage({ slug, locale: "en", body: "Body." });
    await setCmsPageStatus(page.id, "PUBLISHED");
    expect(await getPublishedCmsPage(slug, "en")).not.toBeNull();

    await setCmsPageStatus(page.id, "DRAFT");
    expect(await getPublishedCmsPage(slug, "en")).toBeNull();
  });

  it("updates the body for a specific locale independently of others", async () => {
    const slug = `${PREFIX}locales-${Date.now()}`;
    createdSlugs.push(slug);
    const page = await createCmsPage({ slug, locale: "en", body: "English body." });
    await updateCmsPage(page.id, { locale: "ar", body: "Arabic body." });

    const enView = await getCmsPageForAdmin(page.id, "en");
    const arView = await getCmsPageForAdmin(page.id, "ar");
    expect(enView?.body).toBe("English body.");
    expect(arView?.body).toBe("Arabic body.");
  });

  it("falls back to any available locale's body when the requested one has none", async () => {
    const slug = `${PREFIX}fallback-${Date.now()}`;
    createdSlugs.push(slug);
    const page = await createCmsPage({ slug, locale: "en", body: "English only." });

    const arView = await getCmsPageForAdmin(page.id, "ar");
    expect(arView?.body).toBe("English only.");
  });

  it("refuses to create a page with a duplicate slug", async () => {
    const slug = `${PREFIX}dup-${Date.now()}`;
    createdSlugs.push(slug);
    await createCmsPage({ slug, locale: "en", body: "First." });

    await expect(createCmsPage({ slug, locale: "en", body: "Second." })).rejects.toBeInstanceOf(
      CmsError,
    );
  });

  it("deletes a page and its blocks", async () => {
    const slug = `${PREFIX}delete-${Date.now()}`;
    const page = await createCmsPage({ slug, locale: "en", body: "Body." });

    await deleteCmsPage(page.id);

    const found = await prisma.cmsPage.findUnique({ where: { id: page.id } });
    expect(found).toBeNull();
    const blocks = await prisma.cmsBlock.findMany({ where: { pageId: page.id } });
    expect(blocks).toHaveLength(0);
  });
});
