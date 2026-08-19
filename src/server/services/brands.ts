import "server-only";
import { prisma } from "@/server/db";
import type { z } from "zod";
import type { brandSchema } from "@/server/validation/catalog";

export class BrandError extends Error {}

export function listBrands() {
  return prisma.brand.findMany({ orderBy: { name: "asc" } });
}

export function getBrand(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

type BrandInput = z.infer<typeof brandSchema>;

export async function createBrand(input: BrandInput, logoUrl?: string) {
  const existing = await prisma.brand.findUnique({ where: { slug: input.slug } });
  if (existing) throw new BrandError("A brand with this slug already exists.");

  return prisma.brand.create({
    data: { name: input.name, slug: input.slug, logoUrl },
  });
}

export async function updateBrand(id: string, input: BrandInput, logoUrl?: string) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new BrandError("Brand not found.");

  const slugOwner = await prisma.brand.findUnique({ where: { slug: input.slug } });
  if (slugOwner && slugOwner.id !== id) {
    throw new BrandError("A brand with this slug already exists.");
  }

  return prisma.brand.update({
    where: { id },
    data: { name: input.name, slug: input.slug, ...(logoUrl ? { logoUrl } : {}) },
  });
}

export async function deleteBrand(id: string) {
  const productCount = await prisma.product.count({ where: { brandId: id } });
  if (productCount > 0) {
    throw new BrandError("This brand has products assigned to it and can't be deleted.");
  }
  await prisma.brand.delete({ where: { id } });
}
