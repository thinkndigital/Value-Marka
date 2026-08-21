import "server-only";
import type { z } from "zod";
import { prisma } from "@/server/db";
import { assertSellerOwns } from "@/server/rbac";
import { recordInventoryMovement, recordInventoryMovementStandalone } from "./inventory";
import type { productSchema, stockAdjustmentSchema } from "@/server/validation/product";
import { DEFAULT_PAGE_SIZE, paginate } from "@/server/pagination";

export class ProductError extends Error {}

type ProductInput = z.infer<typeof productSchema>;
type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export async function listProductsForSeller(sellerId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = { sellerId };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        category: { select: { name: true } },
        brand: { select: { name: true } },
        inventory: { select: { quantity: true, reserved: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

/** Customer-facing product detail lookup — only ever returns ACTIVE products. */
export function getActiveProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true } },
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      seller: { select: { storeName: true, storeSlug: true } },
    },
  });
}

export async function getProductForSeller(sellerId: string, id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      inventory: { include: { warehouse: { select: { id: true, name: true } } } },
    },
  });
  if (!product) throw new ProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);
  return product;
}

interface NewImage {
  url: string;
}

export async function createProduct(
  sellerId: string,
  input: ProductInput,
  opts: { warehouseId: string; initialQuantity: number; images: NewImage[]; actorId: string },
) {
  const [category, warehouse, skuTaken, slugTaken] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId } }),
    prisma.warehouse.findUnique({ where: { id: opts.warehouseId } }),
    prisma.product.findUnique({ where: { sellerId_sku: { sellerId, sku: input.sku } } }),
    prisma.product.findUnique({ where: { slug: input.slug } }),
  ]);

  if (!category) throw new ProductError("Category not found.");
  if (!warehouse || warehouse.sellerId !== sellerId) {
    throw new ProductError("Select one of your own warehouses.");
  }
  if (skuTaken) throw new ProductError("You already have a product with this SKU.");
  if (slugTaken) throw new ProductError("That product URL is already taken.");
  if (input.brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
    if (!brand) throw new ProductError("Brand not found.");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sellerId,
        categoryId: input.categoryId,
        brandId: input.brandId,
        slug: input.slug,
        sku: input.sku,
        name: input.name,
        shortDescription: input.shortDescription,
        description: input.description,
        price: input.price,
        costPrice: input.costPrice,
        currencyCode: input.currencyCode,
        weightGrams: input.weightGrams,
        status: "ACTIVE",
        images: { create: opts.images.map((img, i) => ({ url: img.url, sortOrder: i })) },
      },
    });

    if (opts.initialQuantity > 0) {
      await recordInventoryMovement(tx, {
        productId: product.id,
        warehouseId: opts.warehouseId,
        type: "PURCHASE",
        quantity: opts.initialQuantity,
        reason: "Opening stock on product creation",
        referenceType: "Product",
        referenceId: product.id,
        actorId: opts.actorId,
      });
    }

    return product;
  });
}

export async function updateProduct(
  sellerId: string,
  id: string,
  input: ProductInput,
  newImages: NewImage[] = [],
) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);

  const [category, skuOwner, slugOwner] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId } }),
    prisma.product.findUnique({ where: { sellerId_sku: { sellerId, sku: input.sku } } }),
    prisma.product.findUnique({ where: { slug: input.slug } }),
  ]);
  if (!category) throw new ProductError("Category not found.");
  if (skuOwner && skuOwner.id !== id) {
    throw new ProductError("You already have a product with this SKU.");
  }
  if (slugOwner && slugOwner.id !== id) {
    throw new ProductError("That product URL is already taken.");
  }
  if (input.brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
    if (!brand) throw new ProductError("Brand not found.");
  }

  return prisma.product.update({
    where: { id },
    data: {
      categoryId: input.categoryId,
      brandId: input.brandId ?? null,
      slug: input.slug,
      sku: input.sku,
      name: input.name,
      shortDescription: input.shortDescription,
      description: input.description,
      price: input.price,
      costPrice: input.costPrice,
      currencyCode: input.currencyCode,
      weightGrams: input.weightGrams,
      ...(newImages.length > 0
        ? { images: { create: newImages.map((img, i) => ({ url: img.url, sortOrder: 1000 + i })) } }
        : {}),
    },
  });
}

export async function setProductStatus(
  sellerId: string,
  id: string,
  status: "ACTIVE" | "ARCHIVED",
) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);

  return prisma.product.update({ where: { id }, data: { status } });
}

export async function adjustStock(
  sellerId: string,
  productId: string,
  input: StockAdjustmentInput,
  actorId: string,
) {
  const [product, warehouse] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
  ]);
  if (!product) throw new ProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);
  if (!warehouse || warehouse.sellerId !== sellerId) {
    throw new ProductError("Select one of your own warehouses.");
  }

  return recordInventoryMovementStandalone({
    productId,
    warehouseId: input.warehouseId,
    type: "ADJUSTMENT",
    quantity: input.delta,
    reason: input.reason,
    referenceType: "ManualAdjustment",
    actorId,
  });
}
