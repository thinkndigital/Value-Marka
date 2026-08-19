"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { InvalidImageError, uploadImage } from "@/server/storage/upload-image";
import { productSchema, stockAdjustmentSchema } from "@/server/validation/product";
import * as productService from "@/server/services/products";
import { ProductError } from "@/server/services/products";
import { InventoryError } from "@/server/services/inventory";

export interface ProductFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function handleProductError(err: unknown): ProductFormState {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof ProductError ||
    err instanceof InventoryError ||
    err instanceof InvalidImageError
  ) {
    return { error: err.message };
  }
  throw err;
}

async function collectImages(formData: FormData, sellerId: string) {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded = [];
  for (const file of files) {
    uploaded.push(await uploadImage(file, `products/${sellerId}`));
  }
  return uploaded;
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.create", seller.id);

    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      sku: formData.get("sku"),
      categoryId: formData.get("categoryId"),
      brandId: formData.get("brandId"),
      shortDescription: formData.get("shortDescription"),
      description: formData.get("description"),
      price: formData.get("price"),
      costPrice: formData.get("costPrice"),
      currencyCode: formData.get("currencyCode"),
      weightGrams: formData.get("weightGrams") || undefined,
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const warehouseId = String(formData.get("warehouseId") ?? "");
    const initialQuantity = Number(formData.get("initialQuantity") ?? 0);
    if (!warehouseId) {
      return { fieldErrors: { warehouseId: ["Select a warehouse."] } };
    }

    const images = await collectImages(formData, seller.id);

    const product = await productService.createProduct(seller.id, parsed.data, {
      warehouseId,
      initialQuantity: Number.isFinite(initialQuantity) ? Math.max(0, Math.trunc(initialQuantity)) : 0,
      images,
      actorId: user.id,
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      newValue: { name: product.name, sku: product.sku, sellerId: seller.id },
    });

    revalidatePath("/seller/products");
    return { success: true };
  } catch (err) {
    return handleProductError(err);
  }
}

export async function updateProductAction(
  id: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.update", seller.id);

    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      sku: formData.get("sku"),
      categoryId: formData.get("categoryId"),
      brandId: formData.get("brandId"),
      shortDescription: formData.get("shortDescription"),
      description: formData.get("description"),
      price: formData.get("price"),
      costPrice: formData.get("costPrice"),
      currencyCode: formData.get("currencyCode"),
      weightGrams: formData.get("weightGrams") || undefined,
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const images = await collectImages(formData, seller.id);
    const product = await productService.updateProduct(seller.id, id, parsed.data, images);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "product.updated",
      entityType: "Product",
      entityId: id,
      newValue: { name: product.name, sku: product.sku },
    });

    revalidatePath("/seller/products");
    revalidatePath(`/seller/products/${id}`);
    return { success: true };
  } catch (err) {
    return handleProductError(err);
  }
}

export async function setProductStatusAction(
  id: string,
  status: "ACTIVE" | "ARCHIVED",
  _prevState: ProductFormState,
  _formData: FormData,
): Promise<ProductFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.update", seller.id);

    await productService.setProductStatus(seller.id, id, status);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: status === "ARCHIVED" ? "product.archived" : "product.activated",
      entityType: "Product",
      entityId: id,
    });

    revalidatePath("/seller/products");
    return { success: true };
  } catch (err) {
    return handleProductError(err);
  }
}

export async function adjustStockAction(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "inventory.update", seller.id);

    const parsed = stockAdjustmentSchema.safeParse({
      warehouseId: formData.get("warehouseId"),
      delta: formData.get("delta"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await productService.adjustStock(seller.id, productId, parsed.data, user.id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "inventory.adjusted",
      entityType: "Product",
      entityId: productId,
      newValue: parsed.data,
    });

    revalidatePath(`/seller/products/${productId}`);
    return { success: true };
  } catch (err) {
    return handleProductError(err);
  }
}
