import "server-only";
import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  CreateIntentInput,
  CreateIntentResult,
  CaptureResult,
  RefundInput,
  RefundResult,
  OnboardSellerInput,
  OnboardSellerResult,
  TransferInput,
  TransferResult,
  VerifiedWebhookEvent,
} from "./PaymentProvider";
import { PaymentProviderError } from "./PaymentProvider";
import { toDecimalString } from "./money";

function getBaseUrl(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalFetch(path: string, init: RequestInit & { auth?: "basic" | "bearer" } = {}) {
  const { auth = "bearer", headers, ...rest } = init;
  const authHeader =
    auth === "basic"
      ? `Basic ${Buffer.from(`${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`).toString("base64")}`
      : `Bearer ${await getAccessToken()}`;

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
      Authorization: authHeader,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PaymentProviderError(
      `PayPal API error (${response.status}) on ${path}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new PaymentProviderError(`${name} is not configured — see .env.example.`);
  return value;
}

// Access tokens are short-lived (~9h) and cheap to fetch fresh; a tiny
// in-memory cache avoids a round trip on every call within that window.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const body = await paypalFetch("/v1/oauth2/token", {
    method: "POST",
    auth: "basic",
    body: "grant_type=client_credentials",
  });
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function paypalJson(path: string, method: string, json?: unknown) {
  return paypalFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: json ? JSON.stringify(json) : undefined,
  });
}

export const paypalProvider: PaymentProvider = {
  type: "PAYPAL",

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const order = await paypalJson("/v2/checkout/orders", "POST", {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.orderId,
          description: input.description,
          amount: {
            currency_code: input.currencyCode,
            value: toDecimalString(input.amount, input.currencyDecimalDigits),
          },
        },
      ],
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
      },
    });

    const approveLink = (order.links as { rel: string; href: string }[]).find((l) => l.rel === "approve");
    if (!approveLink) {
      throw new PaymentProviderError("PayPal did not return an approval link.");
    }

    return { providerRef: order.id, redirectUrl: approveLink.href };
  },

  async capture(providerRef: string): Promise<CaptureResult> {
    const result = await paypalJson(`/v2/checkout/orders/${providerRef}/capture`, "POST");
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];

    const status: CaptureResult["status"] =
      result.status === "COMPLETED" ? "CAPTURED" : result.status === "VOIDED" ? "FAILED" : "PENDING";

    return {
      providerRef: result.id,
      status,
      capturedAmount: capture ? Number(capture.amount.value) : 0,
      rawPayload: result,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    // input.providerRef is the PayPal Order id from createIntent — refunds
    // are per-capture, so resolve the capture id from the order first.
    const order = await paypalJson(`/v2/checkout/orders/${input.providerRef}`, "GET");
    const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) {
      throw new PaymentProviderError("This PayPal order has no captured payment to refund.");
    }

    const refund = await paypalJson(`/v2/payments/captures/${captureId}/refund`, "POST", {
      amount: {
        currency_code: order.purchase_units[0].amount.currency_code,
        value: toDecimalString(input.amount, input.currencyDecimalDigits),
      },
    });

    return { providerRef: refund.id, amount: Number(refund.amount?.value ?? input.amount) };
  },

  /**
   * Requires PayPal Partner Program enrollment (a partner/BN code) beyond a
   * plain client_id/secret — this call is real and correctly shaped per
   * PayPal's Partner Referrals v2 API, but will fail with a real PayPal
   * error until the platform account has that enrollment.
   */
  async onboardSeller(input: OnboardSellerInput): Promise<OnboardSellerResult> {
    const referral = await paypalJson("/v2/customer/partner-referrals", "POST", {
      tracking_id: input.sellerId,
      operations: [{ operation: "API_INTEGRATION", api_integration_preference: {
        rest_api_integration: {
          integration_method: "PAYPAL",
          integration_type: "THIRD_PARTY",
          third_party_details: { features: ["PAYMENT", "REFUND"] },
        },
      } }],
      products: ["EXPRESS_CHECKOUT"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      partner_config_override: { return_url: input.returnUrl },
    });

    const actionLink = (referral.links as { rel: string; href: string }[]).find(
      (l) => l.rel === "action_url",
    );
    if (!actionLink) {
      throw new PaymentProviderError("PayPal did not return an onboarding action URL.");
    }

    return { accountId: referral.tracking_id ?? input.sellerId, onboardingUrl: actionLink.href };
  },

  async transferToSeller(input: TransferInput): Promise<TransferResult> {
    const payout = await paypalJson("/v1/payments/payouts", "POST", {
      sender_batch_header: {
        sender_batch_id: randomUUID(),
        email_subject: "You have a payout from Value Marka",
      },
      items: [
        {
          recipient_type: "PAYPAL_ID",
          receiver: input.accountId,
          amount: {
            value: toDecimalString(input.amount, input.currencyDecimalDigits),
            currency: input.currencyCode,
          },
          sender_item_id: input.referenceId,
          note: `${input.referenceType} ${input.referenceId}`,
        },
      ],
    });

    return { providerRef: payout.batch_header?.payout_batch_id ?? "" };
  },

  verifyWebhook(): VerifiedWebhookEvent {
    // PayPal's signature check is a server-to-server API call (unlike
    // Stripe's local HMAC), so it can't be done synchronously here without
    // an async round trip. The webhook route calls verifyWebhookAsync
    // below directly instead of going through this interface method.
    throw new PaymentProviderError(
      "Use verifyPaypalWebhookAsync for PayPal — signature checks require an API call.",
    );
  },
};

export interface PaypalWebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

export async function verifyPaypalWebhookAsync(
  rawBody: string,
  headers: PaypalWebhookHeaders,
): Promise<VerifiedWebhookEvent> {
  const webhookEvent = JSON.parse(rawBody);
  const result = await paypalJson("/v1/notifications/verify-webhook-signature", "POST", {
    transmission_id: headers.transmissionId,
    transmission_time: headers.transmissionTime,
    cert_url: headers.certUrl,
    auth_algo: headers.authAlgo,
    transmission_sig: headers.transmissionSig,
    webhook_id: requireEnv("PAYPAL_WEBHOOK_ID"),
    webhook_event: webhookEvent,
  });

  if (result.verification_status !== "SUCCESS") {
    throw new PaymentProviderError("PayPal webhook signature verification failed.");
  }

  return { eventId: webhookEvent.id, type: webhookEvent.event_type, data: webhookEvent.resource };
}
