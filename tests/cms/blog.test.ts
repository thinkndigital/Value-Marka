import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as blog from "@/server/services/blog";
import { BlogError } from "@/server/services/blog";

const PREFIX = "blog-test-";
const createdPostIds: string[] = [];
const createdCategoryIds: string[] = [];
let authorId: string;

async function createPost(overrides: Partial<blog.BlogPostInput> = {}) {
  const post = await blog.createBlogPost(authorId, {
    slug: overrides.slug ?? `${PREFIX}post-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    titleEn: overrides.titleEn ?? "Test Post",
    titleAr: overrides.titleAr ?? "منشور تجريبي",
    bodyEn: overrides.bodyEn ?? "English body.",
    bodyAr: overrides.bodyAr ?? "نص عربي.",
    excerptEn: overrides.excerptEn,
    excerptAr: overrides.excerptAr,
    coverImageUrl: overrides.coverImageUrl,
    seoTitle: overrides.seoTitle,
    seoDescription: overrides.seoDescription,
    categoryId: overrides.categoryId,
    tagSlugs: overrides.tagSlugs ?? [],
  });
  createdPostIds.push(post.id);
  return post;
}

beforeAll(async () => {
  const author = await prisma.user.create({
    data: {
      email: `${PREFIX}author-${Date.now()}@example.com`,
      firstName: "Blog",
      lastName: "Author",
      passwordHash: "unused",
    },
  });
  authorId = author.id;
});

afterAll(async () => {
  await prisma.blogPostTag.deleteMany({ where: { postId: { in: createdPostIds } } });
  await prisma.blogPost.deleteMany({ where: { id: { in: createdPostIds } } });
  await prisma.blogCategory.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.blogTag.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("blog posts", () => {
  it("is not visible on the public read path until published", async () => {
    const post = await createPost();
    expect(await blog.getPublishedPostBySlug(post.slug)).toBeNull();
  });

  it("becomes visible after publishing and invisible again after unpublishing", async () => {
    const post = await createPost();
    await blog.setBlogPostStatus(post.id, "PUBLISHED");
    const published = await blog.getPublishedPostBySlug(post.slug);
    expect(published?.id).toBe(post.id);
    expect(published?.publishedAt).not.toBeNull();

    await blog.setBlogPostStatus(post.id, "DRAFT");
    expect(await blog.getPublishedPostBySlug(post.slug)).toBeNull();
  });

  it("refuses to create a post with a duplicate slug", async () => {
    const post = await createPost();
    await expect(
      blog.createBlogPost(authorId, {
        slug: post.slug,
        titleEn: "Dup",
        titleAr: "مكرر",
        bodyEn: "b",
        bodyAr: "ب",
        tagSlugs: [],
      }),
    ).rejects.toBeInstanceOf(BlogError);
  });

  it("attaches and replaces tags via upsert-by-slug", async () => {
    const post = await createPost({ tagSlugs: [`${PREFIX}tips`, `${PREFIX}shipping`] });
    const withTags = await blog.getBlogPostForAdmin(post.id);
    expect(withTags.tags.map((t) => t.tag.slug).sort()).toEqual(
      [`${PREFIX}shipping`, `${PREFIX}tips`].sort(),
    );

    await blog.updateBlogPost(post.id, {
      titleEn: post.titleEn,
      titleAr: post.titleAr,
      bodyEn: post.bodyEn,
      bodyAr: post.bodyAr,
      tagSlugs: [`${PREFIX}tips`],
    });
    const updated = await blog.getBlogPostForAdmin(post.id);
    expect(updated.tags.map((t) => t.tag.slug)).toEqual([`${PREFIX}tips`]);
  });

  it("rejects operating on an unknown post", async () => {
    await expect(blog.getBlogPostForAdmin("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      BlogError,
    );
  });

  it("deletes a post and its tag links", async () => {
    const post = await createPost({ tagSlugs: [`${PREFIX}delete-me`] });
    await blog.deleteBlogPost(post.id);
    createdPostIds.splice(createdPostIds.indexOf(post.id), 1);

    expect(await prisma.blogPost.findUnique({ where: { id: post.id } })).toBeNull();
    expect(await prisma.blogPostTag.findMany({ where: { postId: post.id } })).toHaveLength(0);
  });
});

describe("blog categories", () => {
  it("creates, refuses a duplicate slug, and refuses deleting a category with posts", async () => {
    const category = await blog.createBlogCategory({
      slug: `${PREFIX}cat-${Date.now()}`,
      nameEn: "Tips",
      nameAr: "نصائح",
    });
    createdCategoryIds.push(category.id);

    await expect(
      blog.createBlogCategory({ slug: category.slug, nameEn: "x", nameAr: "x" }),
    ).rejects.toBeInstanceOf(BlogError);

    await createPost({ categoryId: category.id });
    await expect(blog.deleteBlogCategory(category.id)).rejects.toBeInstanceOf(BlogError);
  });
});

describe("listPublishedPosts", () => {
  it("only returns published posts, filterable by category", async () => {
    const category = await blog.createBlogCategory({
      slug: `${PREFIX}filter-cat-${Date.now()}`,
      nameEn: "Filter",
      nameAr: "تصفية",
    });
    createdCategoryIds.push(category.id);

    const inCategory = await createPost({ categoryId: category.id });
    await blog.setBlogPostStatus(inCategory.id, "PUBLISHED");
    const outsideCategory = await createPost();
    await blog.setBlogPostStatus(outsideCategory.id, "PUBLISHED");
    const draft = await createPost({ categoryId: category.id });

    const filtered = await blog.listPublishedPosts(1, category.slug);
    const filteredIds = filtered.items.map((p) => p.id);
    expect(filteredIds).toContain(inCategory.id);
    expect(filteredIds).not.toContain(outsideCategory.id);
    expect(filteredIds).not.toContain(draft.id);
  });
});
