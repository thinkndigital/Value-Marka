"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { supplierSchema } from "@/server/validation/supplier";
import * as supplierService from "@/server/services/suppliers";
import { SupplierError } from "@/server/services/suppliers";

export interface SupplierFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function parseSupplierForm(formData: FormData) {
  return supplierSchema.safeParse({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    countryCode: formData.get("countryCode") || undefined,
    address: formData.get("address") || undefined,
    paymentTerms: formData.get("paymentTerms") || undefined,
  });
}

function handleError(err: unknown): SupplierFormState {
  if (err instanceof SupplierError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
    return { error: err.message };
  }
  throw err;
}

export async function createSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "suppliers.create", seller.id);

    const parsed = parseSupplierForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const supplier = await supplierService.createSupplier(seller.id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "supplier.created",
      entityType: "Supplier",
      entityId: supplier.id,
      newValue: { companyName: supplier.companyName },
    });

    revalidatePath("/seller/suppliers");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function updateSupplierAction(
  id: string,
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "suppliers.update", seller.id);

    const parsed = parseSupplierForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await supplierService.updateSupplier(seller.id, id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "supplier.updated",
      entityType: "Supplier",
      entityId: id,
    });

    revalidatePath("/seller/suppliers");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteSupplierAction(
  id: string,
  _prevState: SupplierFormState,
  _formData: FormData,
): Promise<SupplierFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "suppliers.delete", seller.id);

    await supplierService.deleteSupplier(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "supplier.deleted",
      entityType: "Supplier",
      entityId: id,
    });

    revalidatePath("/seller/suppliers");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
