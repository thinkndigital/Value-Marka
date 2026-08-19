import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export type SearchSort = "newest" | "price_asc" | "price_desc";

export interface SearchParams {
  q?: string;
  categorySlug?: string;
  sort?: SearchSort;
  page?: number;
}

const PAGE_SIZE = 24;

function buildWhere({ q, categorySlug }: SearchParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
    ];
  }

  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  return where;
}

function buildOrderBy(sort?: SearchSort): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export async function searchProducts(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const where = buildWhere(params);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(params.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        seller: { select: { storeName: true, storeSlug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export function listSearchableCategories() {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { status: "ACTIVE" } } },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
}
