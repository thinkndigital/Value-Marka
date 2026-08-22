import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DEFAULT_PAGE_SIZE, paginate } from "@/server/pagination";

export class BlogError extends Error {}

export interface BlogPostInput {
  slug: string;
  titleEn: string;
  titleAr: string;
  excerptEn?: string;
  excerptAr?: string;
  bodyEn: string;
  bodyAr: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  categoryId?: string;
  tagSlugs: string[];
}

async function upsertTags(tx: Prisma.TransactionClient, tagSlugs: string[]) {
  const tags = await Promise.all(
    tagSlugs.map((slug) =>
      tx.blogTag.upsert({
        where: { slug },
        update: {},
        create: { slug, nameEn: slug, nameAr: slug },
      }),
    ),
  );
  return tags;
}

async function setPostTags(tx: Prisma.TransactionClient, postId: string, tagSlugs: string[]) {
  const tags = await upsertTags(tx, tagSlugs);
  await tx.blogPostTag.deleteMany({ where: { postId } });
  if (tags.length > 0) {
    await tx.blogPostTag.createMany({
      data: tags.map((tag) => ({ postId, tagId: tag.id })),
    });
  }
}

const postInclude = {
  category: true,
  tags: { include: { tag: true } },
  author: { select: { firstName: true, lastName: true } },
};

// ── Admin ─────────────────────────────────────────────────────────────────

export function listBlogPostsForAdmin() {
  return prisma.blogPost.findMany({
    include: postInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getBlogPostForAdmin(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id }, include: postInclude });
  if (!post) throw new BlogError("Post not found.");
  return post;
}

export async function createBlogPost(authorId: string, input: BlogPostInput) {
  const existing = await prisma.blogPost.findUnique({ where: { slug: input.slug } });
  if (existing) throw new BlogError("A post with this slug already exists.");

  return prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.create({
      data: {
        slug: input.slug,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        excerptEn: input.excerptEn,
        excerptAr: input.excerptAr,
        bodyEn: input.bodyEn,
        bodyAr: input.bodyAr,
        coverImageUrl: input.coverImageUrl,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        categoryId: input.categoryId || null,
        authorId,
      },
    });
    await setPostTags(tx, post.id, input.tagSlugs);
    return post;
  });
}

export async function updateBlogPost(id: string, input: Omit<BlogPostInput, "slug">) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new BlogError("Post not found.");

  return prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.update({
      where: { id },
      data: {
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        excerptEn: input.excerptEn,
        excerptAr: input.excerptAr,
        bodyEn: input.bodyEn,
        bodyAr: input.bodyAr,
        coverImageUrl: input.coverImageUrl,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        categoryId: input.categoryId || null,
      },
    });
    await setPostTags(tx, post.id, input.tagSlugs);
    return post;
  });
}

export async function setBlogPostStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new BlogError("Post not found.");
  return prisma.blogPost.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    },
  });
}

export async function deleteBlogPost(id: string) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new BlogError("Post not found.");
  await prisma.blogPost.delete({ where: { id } });
}

export function listBlogCategories() {
  return prisma.blogCategory.findMany({ orderBy: { nameEn: "asc" } });
}

export interface BlogCategoryInput {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export async function createBlogCategory(input: BlogCategoryInput) {
  const existing = await prisma.blogCategory.findUnique({ where: { slug: input.slug } });
  if (existing) throw new BlogError("A category with this slug already exists.");
  return prisma.blogCategory.create({ data: input });
}

export async function deleteBlogCategory(id: string) {
  const postCount = await prisma.blogPost.count({ where: { categoryId: id } });
  if (postCount > 0) throw new BlogError("Move or delete this category's posts first.");
  await prisma.blogCategory.delete({ where: { id } });
}

export function listBlogTags() {
  return prisma.blogTag.findMany({ orderBy: { slug: "asc" } });
}

// ── Public/storefront ────────────────────────────────────────────────────

export async function listPublishedPosts(page = 1, categorySlug?: string) {
  const where: Prisma.BlogPostWhereInput = {
    status: "PUBLISHED",
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      include: postInclude,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);
  return paginate(items, total, page, DEFAULT_PAGE_SIZE);
}

export function getPublishedPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: postInclude,
  });
}
