"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import * as affiliateService from "@/server/services/affiliates";
import { AffiliateError } from "@/server/services/affiliates";

export interface AffiliateFormState {
  error?: string;
  success?: boolean;
}

function handleError(err: unknown): AffiliateFormState {
  if (err instanceof AffiliateError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
    return { error: err.message };
  }
  throw err;
}

export async function applyToBeAffiliateAction(
  _prevState: AffiliateFormState,
  _formData: FormData,
): Promise<AffiliateFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const affiliate = await affiliateService.applyToBeAffiliate(user.id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "affiliate.applied",
      entityType: "Affiliate",
      entityId: affiliate.id,
    });

    revalidatePath("/account/affiliate");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function createAffiliateLinkAction(
  _prevState: AffiliateFormState,
  formData: FormData,
): Promise<AffiliateFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const affiliate = await affiliateService.getAffiliateForUser(user.id);
    if (!affiliate) throw new AffiliateError("You're not an affiliate yet.");

    const targetUrl = String(formData.get("targetUrl") ?? "").trim();
    if (!targetUrl) return { error: "Enter a page to link to." };

    await affiliateService.createAffiliateLink(affiliate.id, { targetUrl });

    revalidatePath("/account/affiliate");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function approveAffiliateAction(
  affiliateId: string,
  _prevState: AffiliateFormState,
  _formData: FormData,
): Promise<AffiliateFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "affiliates.manage");
    await affiliateService.approveAffiliate(affiliateId);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "affiliate.approved",
      entityType: "Affiliate",
      entityId: affiliateId,
    });

    revalidatePath("/admin/affiliates");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function suspendAffiliateAction(
  affiliateId: string,
  _prevState: AffiliateFormState,
  _formData: FormData,
): Promise<AffiliateFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "affiliates.manage");
    await affiliateService.suspendAffiliate(affiliateId);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "affiliate.suspended",
      entityType: "Affiliate",
      entityId: affiliateId,
    });

    revalidatePath("/admin/affiliates");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
