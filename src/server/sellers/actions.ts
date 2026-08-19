"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { rejectSellerSchema, sellerApplicationSchema } from "@/server/validation/seller";
import * as sellerService from "@/server/services/sellers";
import { SellerError } from "@/server/services/sellers";

export interface SellerFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleSellerError(err: unknown): SellerFormState {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof SellerError
  ) {
    return { error: err.message };
  }
  throw err;
}

export async function submitSellerApplicationAction(
  _prevState: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  try {
    const user = await requireCurrentUser();

    const parsed = sellerApplicationSchema.safeParse({
      storeName: formData.get("storeName"),
      storeSlug: formData.get("storeSlug"),
      countryCode: formData.get("countryCode"),
      businessType: formData.get("businessType"),
      taxId: formData.get("taxId"),
      description: formData.get("description"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const seller = await sellerService.submitSellerApplication(user.id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "seller.application_submitted",
      entityType: "Seller",
      entityId: seller.id,
      newValue: { storeName: seller.storeName, storeSlug: seller.storeSlug },
    });

    revalidatePath("/sell");
    return { success: true };
  } catch (err) {
    return handleSellerError(err);
  }
}

export async function approveSellerAction(
  sellerId: string,
  _prevState: SellerFormState,
  _formData: FormData,
): Promise<SellerFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "sellers.approve");

    const seller = await sellerService.approveSellerApplication(sellerId, user.id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "seller.approved",
      entityType: "Seller",
      entityId: seller.id,
    });

    revalidatePath("/admin/sellers");
    revalidatePath(`/admin/sellers/${sellerId}`);
    return { success: true };
  } catch (err) {
    return handleSellerError(err);
  }
}

export async function rejectSellerAction(
  sellerId: string,
  _prevState: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, "sellers.approve");

    const parsed = rejectSellerSchema.safeParse({ reason: formData.get("reason") });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const seller = await sellerService.rejectSellerApplication(
      sellerId,
      user.id,
      parsed.data.reason,
    );

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "seller.rejected",
      entityType: "Seller",
      entityId: seller.id,
      newValue: { reason: parsed.data.reason },
    });

    revalidatePath("/admin/sellers");
    revalidatePath(`/admin/sellers/${sellerId}`);
    return { success: true };
  } catch (err) {
    return handleSellerError(err);
  }
}
