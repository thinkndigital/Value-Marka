"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import * as payoutService from "@/server/services/payouts";
import { PayoutError } from "@/server/services/payouts";

export interface PayoutActionState {
  error?: string;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handlePayoutError(err: unknown): PayoutActionState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof PayoutError) {
    return { error: err.message };
  }
  throw err;
}

async function runAdminAction(
  payoutId: string,
  permission: string,
  action: (payoutId: string) => Promise<unknown>,
  auditAction: string,
): Promise<PayoutActionState> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(user.id, permission);

    await action(payoutId);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: auditAction,
      entityType: "Payout",
      entityId: payoutId,
    });

    revalidatePath("/admin/payouts");
    return { success: true };
  } catch (err) {
    return handlePayoutError(err);
  }
}

export async function approvePayoutAction(
  payoutId: string,
  _prevState: PayoutActionState,
  _formData: FormData,
) {
  return runAdminAction(payoutId, "payouts.approve", payoutService.approvePayout, "payout.approved");
}

export async function holdPayoutAction(
  payoutId: string,
  _prevState: PayoutActionState,
  _formData: FormData,
) {
  return runAdminAction(payoutId, "payouts.approve", payoutService.holdPayout, "payout.held");
}

export async function rejectPayoutAction(
  payoutId: string,
  _prevState: PayoutActionState,
  _formData: FormData,
) {
  return runAdminAction(payoutId, "payouts.reject", payoutService.rejectPayout, "payout.rejected");
}

export async function releasePayoutAction(
  payoutId: string,
  _prevState: PayoutActionState,
  _formData: FormData,
) {
  return runAdminAction(payoutId, "payouts.approve", payoutService.releasePayout, "payout.released");
}
