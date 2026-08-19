"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { shipmentSchema } from "@/server/validation/order";
import { transitionSellerOrder, getSellerOrderForSeller, OrderError } from "@/server/services/orders";
import { refundSellerOrder, PaymentError } from "@/server/services/payments";

export interface SellerOrderFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function runTransition(
  sellerOrderId: string,
  nextStatus: Parameters<typeof transitionSellerOrder>[2],
  extra: { carrier?: string; trackingNumber?: string } = {},
): Promise<SellerOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "orders.update", seller.id);

    const updated = await transitionSellerOrder(seller.id, sellerOrderId, nextStatus, {
      actorId: user.id,
      ...extra,
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "sellerOrder.statusChanged",
      entityType: "SellerOrder",
      entityId: sellerOrderId,
      newValue: { status: nextStatus },
    });

    revalidatePath("/seller/orders");
    revalidatePath(`/seller/orders/${sellerOrderId}`);
    revalidatePath(`/account/orders/${updated.order.orderNumber}`);
    return { success: true };
  } catch (err) {
    if (err instanceof OrderError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function confirmOrderAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "CONFIRMED");
}

export async function startProcessingAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "PROCESSING");
}

export async function markPackedAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "PACKED");
}

export async function shipOrderAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  formData: FormData,
): Promise<SellerOrderFormState> {
  const parsed = shipmentSchema.safeParse({
    carrier: formData.get("carrier"),
    trackingNumber: formData.get("trackingNumber"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }
  return runTransition(sellerOrderId, "SHIPPED", parsed.data);
}

export async function markOutForDeliveryAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "OUT_FOR_DELIVERY");
}

export async function markDeliveredAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "DELIVERED");
}

export async function cancelSellerOrderAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "CANCELLED");
}

export async function approveReturnAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "RETURNED");
}

export async function rejectReturnAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
) {
  return runTransition(sellerOrderId, "DELIVERED");
}

export async function markRefundedAction(
  sellerOrderId: string,
  _prevState: SellerOrderFormState,
  _formData: FormData,
): Promise<SellerOrderFormState> {
  try {
    // Same authorization gate transitionSellerOrder itself enforces —
    // required here too since the real provider refund call must happen
    // only after the caller is confirmed to *own this specific order*, not
    // just be *some* approved seller.
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "orders.update", seller.id);
    await getSellerOrderForSeller(seller.id, sellerOrderId); // throws if not this seller's order

    // If the parent order was paid online, actually issue the refund
    // through the provider before flipping the status — a no-op for a COD
    // order (refundSellerOrder returns null when there's no captured
    // Payment), in which case this just records the offline/cash
    // settlement as before.
    await refundSellerOrder(sellerOrderId);
  } catch (err) {
    if (
      err instanceof PaymentError ||
      err instanceof ForbiddenError ||
      err instanceof UnauthorizedError ||
      err instanceof OrderError
    ) {
      return { error: err.message };
    }
    throw err;
  }

  return runTransition(sellerOrderId, "REFUNDED");
}
