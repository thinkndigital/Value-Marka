"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { rewardRuleSchema, redeemPointsSchema } from "@/server/validation/loyalty";
import * as loyaltyService from "@/server/services/loyalty";
import { LoyaltyError } from "@/server/services/loyalty";

export interface LoyaltyFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  couponCode?: string;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleError(err: unknown): LoyaltyFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof LoyaltyError) {
    return { error: err.message };
  }
  throw err;
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// ── Admin: reward rule ────────────────────────────────────────────────────
// Reuses the campaigns.* permissions (already seeded, already wired to
// flash sales — see src/server/flashSales/actions.ts) rather than a new key.

export async function createRewardRuleAction(
  _prevState: LoyaltyFormState,
  formData: FormData,
): Promise<LoyaltyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.create");

    const parsed = rewardRuleSchema.safeParse({
      pointsPerCurrencyUnit: formData.get("pointsPerCurrencyUnit"),
      redemptionValue: formData.get("redemptionValue"),
      effectiveAt: formData.get("effectiveAt"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const rule = await loyaltyService.createRewardRule(parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "loyalty.rule_created",
      entityType: "RewardRule",
      entityId: rule.id,
      newValue: {
        pointsPerCurrencyUnit: rule.pointsPerCurrencyUnit.toString(),
        redemptionValue: rule.redemptionValue.toString(),
      },
    });

    revalidatePath("/admin/marketing/loyalty");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteRewardRuleAction(
  id: string,
  _prevState: LoyaltyFormState,
  _formData: FormData,
): Promise<LoyaltyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.delete");

    await loyaltyService.deleteRewardRule(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "loyalty.rule_deleted",
      entityType: "RewardRule",
      entityId: id,
    });

    revalidatePath("/admin/marketing/loyalty");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── Customer: redeem points ───────────────────────────────────────────────

export async function redeemPointsAction(
  _prevState: LoyaltyFormState,
  formData: FormData,
): Promise<LoyaltyFormState> {
  try {
    const user = await requireCurrentUser();

    const parsed = redeemPointsSchema.safeParse({ points: formData.get("points") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const coupon = await loyaltyService.redeemPoints(user.id, parsed.data.points);

    revalidatePath("/account/rewards");
    return { success: true, couponCode: coupon.code };
  } catch (err) {
    return handleError(err);
  }
}
