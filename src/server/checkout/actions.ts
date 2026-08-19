"use server";

import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { placeOrder, CheckoutError } from "@/server/services/checkout";

export interface CheckoutFormState {
  error?: string;
}

export async function placeOrderAction(
  locale: string,
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to check out." };

  const addressId = formData.get("addressId");
  if (typeof addressId !== "string" || !addressId) {
    return { error: "Select a shipping address." };
  }

  let orderNumber: string;
  try {
    const order = await placeOrder(user.id, addressId);
    orderNumber = order.orderNumber;
  } catch (err) {
    if (err instanceof CheckoutError) return { error: err.message };
    throw err;
  }

  redirect({ href: `/account/orders/${orderNumber}`, locale });
  return {};
}
