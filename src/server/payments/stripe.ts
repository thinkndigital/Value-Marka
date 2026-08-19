import "server-only";
import Stripe from "stripe";
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
import { toMinorUnits, fromMinorUnits } from "./money";

let client: Stripe | null = null;

/**
 * Constructed lazily (not at module load) so importing this file — e.g.
 * from a build step or a test that only exercises another provider — never
 * throws just because STRIPE_SECRET_KEY isn't set yet.
 */
function getClient(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new PaymentProviderError(
      "STRIPE_SECRET_KEY is not configured — see .env.example.",
    );
  }
  client = new Stripe(key);
  return client;
}

export const stripeProvider: PaymentProvider = {
  type: "STRIPE",

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const stripe = getClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price_data: {
            currency: input.currencyCode,
            unit_amount: toMinorUnits(input.amount, input.currencyDecimalDigits),
            product_data: { name: input.description ?? `Value Marka order` },
          },
          quantity: 1,
        },
      ],
      metadata: { orderId: input.orderId },
    });

    if (!session.url) {
      throw new PaymentProviderError("Stripe did not return a checkout URL.");
    }

    return { providerRef: session.id, redirectUrl: session.url };
  },

  async capture(providerRef: string, currencyDecimalDigits: number): Promise<CaptureResult> {
    const stripe = getClient();
    const session = await stripe.checkout.sessions.retrieve(providerRef, {
      expand: ["payment_intent"],
    });

    const status: CaptureResult["status"] =
      session.payment_status === "paid"
        ? "CAPTURED"
        : session.status === "expired"
          ? "FAILED"
          : "PENDING";

    return {
      providerRef: session.id,
      status,
      capturedAmount: fromMinorUnits(session.amount_total ?? 0, currencyDecimalDigits),
      rawPayload: session,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const stripe = getClient();
    const session = await stripe.checkout.sessions.retrieve(input.providerRef);
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new PaymentProviderError("This checkout session has no captured payment to refund.");
    }

    const amountMinor = toMinorUnits(input.amount, input.currencyDecimalDigits);
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountMinor,
      reason: "requested_by_customer",
    });

    return {
      providerRef: refund.id,
      amount: fromMinorUnits(refund.amount ?? amountMinor, input.currencyDecimalDigits),
    };
  },

  async onboardSeller(input: OnboardSellerInput): Promise<OnboardSellerResult> {
    const stripe = getClient();
    const account = await stripe.accounts.create({
      type: "express",
      country: input.countryCode,
      email: input.email,
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
    });

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    });

    return { accountId: account.id, onboardingUrl: link.url };
  },

  async transferToSeller(input: TransferInput): Promise<TransferResult> {
    const stripe = getClient();
    const transfer = await stripe.transfers.create({
      amount: toMinorUnits(input.amount, input.currencyDecimalDigits),
      currency: input.currencyCode,
      destination: input.accountId,
      transfer_group: `${input.referenceType}:${input.referenceId}`,
    });
    return { providerRef: transfer.id };
  },

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): VerifiedWebhookEvent {
    const stripe = getClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = headers["stripe-signature"];
    if (!secret) {
      throw new PaymentProviderError("STRIPE_WEBHOOK_SECRET is not configured.");
    }
    if (!signature) {
      throw new PaymentProviderError("Missing Stripe-Signature header.");
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { eventId: event.id, type: event.type, data: event.data.object };
  },
};
