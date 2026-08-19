"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { returnRequestSchema } from "@/server/validation/order";
import { requestCustomerCancellation, requestReturn, OrderError } from "@/server/services/orders";

export interface OrderActionFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
}

export async function cancelOrderAction(
  orderNumber: string,
  _prevState: OrderActionFormState,
  _formData: FormData,
): Promise<OrderActionFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your orders." };

  try {
    const result = await requestCustomerCancellation(user.id, orderNumber);
    revalidatePath(`/account/orders/${orderNumber}`);
    revalidatePath("/account/orders");
    return {
      success: true,
      message:
        result.cancelledCount === result.totalCount
          ? "Your order has been cancelled."
          : `Cancelled ${result.cancelledCount} of ${result.totalCount} seller shipments — the rest were already being fulfilled.`,
    };
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
}

export async function requestReturnAction(
  orderNumber: string,
  sellerOrderId: string,
  _prevState: OrderActionFormState,
  formData: FormData,
): Promise<OrderActionFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your orders." };

  const parsed = returnRequestSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  try {
    await requestReturn(user.id, orderNumber, sellerOrderId, parsed.data.reason);
    revalidatePath(`/account/orders/${orderNumber}`);
    return { success: true };
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
}
