"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { InvalidImageError, uploadImage } from "@/server/storage/upload-image";
import { brandSchema, categorySchema } from "@/server/validation/catalog";
import * as brandService from "@/server/services/brands";
import * as categoryService from "@/server/services/categories";
import { BrandError } from "@/server/services/brands";
import { CategoryError } from "@/server/services/categories";

export interface CatalogFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleCatalogError(err: unknown): CatalogFormState {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof CategoryError ||
    err instanceof BrandError ||
    err instanceof InvalidImageError
  ) {
    return { error: err.message };
  }
  throw err;
}

function extractImage(formData: FormData): File | undefined {
  const file = formData.get("image");
  return file instanceof File && file.size > 0 ? file : undefined;
}

// ── Categories ──────────────────────────────────────────────────────────

export async function createCategoryAction(
  _prevState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "categories.create");

    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      parentId: formData.get("parentId"),
      sortOrder: formData.get("sortOrder") || 0,
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const file = extractImage(formData);
    const uploaded = file ? await uploadImage(file, "categories") : undefined;

    const category = await categoryService.createCategory(parsed.data, uploaded?.url);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      newValue: { name: category.name, slug: category.slug },
    });

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}

export async function updateCategoryAction(
  id: string,
  _prevState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "categories.update");

    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      parentId: formData.get("parentId"),
      sortOrder: formData.get("sortOrder") || 0,
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const before = await categoryService.getCategory(id);
    const file = extractImage(formData);
    const uploaded = file ? await uploadImage(file, "categories") : undefined;

    const category = await categoryService.updateCategory(id, parsed.data, uploaded?.url);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "category.updated",
      entityType: "Category",
      entityId: id,
      oldValue: before ? { name: before.name, slug: before.slug } : undefined,
      newValue: { name: category.name, slug: category.slug },
    });

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}

export async function deleteCategoryAction(
  id: string,
  _prevState: CatalogFormState,
  _formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "categories.delete");

    const before = await categoryService.getCategory(id);
    await categoryService.deleteCategory(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "category.deleted",
      entityType: "Category",
      entityId: id,
      oldValue: before ? { name: before.name, slug: before.slug } : undefined,
    });

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}

// ── Brands ───────────────────────────────────────────────────────────────

export async function createBrandAction(
  _prevState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "brands.create");

    const parsed = brandSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const file = extractImage(formData);
    const uploaded = file ? await uploadImage(file, "brands") : undefined;

    const brand = await brandService.createBrand(parsed.data, uploaded?.url);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "brand.created",
      entityType: "Brand",
      entityId: brand.id,
      newValue: { name: brand.name, slug: brand.slug },
    });

    revalidatePath("/admin/brands");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}

export async function updateBrandAction(
  id: string,
  _prevState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "brands.update");

    const parsed = brandSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const before = await brandService.getBrand(id);
    const file = extractImage(formData);
    const uploaded = file ? await uploadImage(file, "brands") : undefined;

    const brand = await brandService.updateBrand(id, parsed.data, uploaded?.url);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "brand.updated",
      entityType: "Brand",
      entityId: id,
      oldValue: before ? { name: before.name, slug: before.slug } : undefined,
      newValue: { name: brand.name, slug: brand.slug },
    });

    revalidatePath("/admin/brands");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}

export async function deleteBrandAction(
  id: string,
  _prevState: CatalogFormState,
  _formData: FormData,
): Promise<CatalogFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "brands.delete");

    const before = await brandService.getBrand(id);
    await brandService.deleteBrand(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "brand.deleted",
      entityType: "Brand",
      entityId: id,
      oldValue: before ? { name: before.name, slug: before.slug } : undefined,
    });

    revalidatePath("/admin/brands");
    return { success: true };
  } catch (err) {
    return handleCatalogError(err);
  }
}
