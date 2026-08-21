"use server";

import { redirect as redirectExternal } from "next/navigation";
import { cookies } from "next/headers";
import type { PaymentProviderType } from "@prisma/client";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { placeOrder, CheckoutError } from "@/server/services/checkout";
import { initiateOnlinePayment, PaymentError } from "@/server/services/payments";
import { PaymentProviderError } from "@/server/payments/PaymentProvider";
import { AFFILIATE_COOKIE_ID, AFFILIATE_COOKIE_CLICK } from "@/server/affiliates/cookies";

export interface CheckoutFormState {
  error?: string;
}

const ONLINE_PROVIDERS: PaymentProviderType[] = ["STRIPE", "PAYPAL"];

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

  const paymentMethod = formData.get("paymentMethod");
  const provider = ONLINE_PROVIDERS.includes(paymentMethod as PaymentProviderType)
    ? (paymentMethod as PaymentProviderType)
    : null;

  const couponCode = formData.get("couponCode");

  const cookieStore = await cookies();
  const affiliateId = cookieStore.get(AFFILIATE_COOKIE_ID)?.value;
  const affiliateClickId = cookieStore.get(AFFILIATE_COOKIE_CLICK)?.value;

  let orderId: string;
  let orderNumber: string;
  try {
    const order = await placeOrder(user.id, addressId, {
      couponCode: typeof couponCode === "string" && couponCode ? couponCode : undefined,
      affiliateAttribution:
        affiliateId && affiliateClickId
          ? { affiliateId, clickId: affiliateClickId }
          : undefined,
    });
    orderId = order.id;
    orderNumber = order.orderNumber;
  } catch (err) {
    if (err instanceof CheckoutError) return { error: err.message };
    throw err;
  }

  if (provider) {
    try {
      const redirectUrl = await initiateOnlinePayment(orderId, provider, locale);
      redirectExternal(redirectUrl);
    } catch (err) {
      if (err instanceof PaymentError || err instanceof PaymentProviderError) {
        // The order was already placed — send the customer to it rather
        // than losing the order because the payment step failed to start.
        redirect({ href: `/account/orders/${orderNumber}`, locale });
      }
      throw err;
    }
  }

  redirect({ href: `/account/orders/${orderNumber}`, locale });
  return {};
}
