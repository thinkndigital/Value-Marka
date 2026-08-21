"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { couponSchema } from "@/server/validation/coupon";
import * as couponService from "@/server/services/coupons";
import { CouponError } from "@/server/services/coupons";

export interface CouponFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function parseCouponForm(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value") || 0,
    minOrderTotal: formData.get("minOrderTotal") || undefined,
    maxDiscount: formData.get("maxDiscount") || undefined,
    usageLimit: formData.get("usageLimit") || undefined,
    usageLimitPerUser: formData.get("usageLimitPerUser") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
  });
}

function handleError(err: unknown): CouponFormState {
  if (err instanceof CouponError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
    return { error: err.message };
  }
  throw err;
}

export async function createSellerCouponAction(
  _prevState: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "coupons.create", seller.id);

    const parsed = parseCouponForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const coupon = await couponService.createCoupon(seller.id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "coupon.created",
      entityType: "Coupon",
      entityId: coupon.id,
      newValue: { code: coupon.code },
    });

    revalidatePath("/seller/coupons");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deactivateSellerCouponAction(
  id: string,
  _prevState: CouponFormState,
  _formData: FormData,
): Promise<CouponFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "coupons.update", seller.id);
    await couponService.deactivateCoupon(seller.id, id);

    revalidatePath("/seller/coupons");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function createPlatformCouponAction(
  _prevState: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "coupons.create");

    const parsed = parseCouponForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const coupon = await couponService.createCoupon(null, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "coupon.created",
      entityType: "Coupon",
      entityId: coupon.id,
      newValue: { code: coupon.code },
    });

    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deactivatePlatformCouponAction(
  id: string,
  _prevState: CouponFormState,
  _formData: FormData,
): Promise<CouponFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "coupons.update");
    await couponService.deactivateCoupon(null, id);

    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
