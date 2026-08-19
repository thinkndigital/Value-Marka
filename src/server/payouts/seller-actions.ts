"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { payoutRequestSchema } from "@/server/validation/payout";
import { requestPayout, PayoutError } from "@/server/services/payouts";

export interface PayoutFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

export async function requestPayoutAction(
  currencyCode: string,
  _prevState: PayoutFormState,
  formData: FormData,
): Promise<PayoutFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "payouts.create", seller.id);

    const parsed = payoutRequestSchema.safeParse({
      amount: formData.get("amount"),
      method: formData.get("method"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const payout = await requestPayout(seller.id, parsed.data.amount, currencyCode, parsed.data.method);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "payout.requested",
      entityType: "Payout",
      entityId: payout.id,
      newValue: { amount: parsed.data.amount, currencyCode, method: parsed.data.method },
    });

    revalidatePath("/seller/payouts");
    return { success: true };
  } catch (err) {
    if (err instanceof PayoutError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}
