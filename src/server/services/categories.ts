import "server-only";
import { prisma } from "@/server/db";
import type { z } from "zod";
import type { categorySchema } from "@/server/validation/catalog";

export class CategoryError extends Error {}

export function listCategoriesWithParent() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { parent: { select: { id: true, name: true } } },
  });
}

export function getCategory(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

type CategoryInput = z.infer<typeof categorySchema>;

export async function createCategory(input: CategoryInput, imageUrl?: string) {
  const existing = await prisma.category.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new CategoryError("A category with this slug already exists.");
  }

  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) throw new CategoryError("Parent category not found.");
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      imageUrl,
    },
  });
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  imageUrl?: string,
) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new CategoryError("Category not found.");

  if (input.parentId === id) {
    throw new CategoryError("A category cannot be its own parent.");
  }

  const slugOwner = await prisma.category.findUnique({
    where: { slug: input.slug },
  });
  if (slugOwner && slugOwner.id !== id) {
    throw new CategoryError("A category with this slug already exists.");
  }

  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
      ...(imageUrl ? { imageUrl } : {}),
    },
  });
}

export async function deleteCategory(id: string) {
  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (childCount > 0) {
    throw new CategoryError("Move or delete its subcategories first.");
  }
  if (productCount > 0) {
    throw new CategoryError(
      "This category has products assigned to it and can't be deleted.",
    );
  }

  await prisma.category.delete({ where: { id } });
}
