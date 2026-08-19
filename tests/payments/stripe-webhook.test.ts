import { beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { stripeProvider } from "@/server/payments/stripe";
import { PaymentProviderError } from "@/server/payments/PaymentProvider";

// Stripe webhook signature verification is pure local HMAC-SHA256 — no
// network call — so it's fully testable without a live Stripe account: we
// sign a payload with a secret we control and confirm our own verification
// code accepts it, rejects a wrong secret, and rejects a tampered payload.
// (PayPal's equivalent check is a live API call and isn't testable this way
// — see src/server/payments/paypal.ts's verifyPaypalWebhookAsync.)

const TEST_WEBHOOK_SECRET = "whsec_test_secret_for_signature_verification_only";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_never_used_for_a_real_api_call";
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
});

function sign(payload: string, secret = TEST_WEBHOOK_SECRET) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

describe("stripeProvider.verifyWebhook", () => {
  it("accepts a correctly signed event and normalizes it", () => {
    const payload = JSON.stringify({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_456", payment_status: "paid" } },
    });

    const result = stripeProvider.verifyWebhook(payload, { "stripe-signature": sign(payload) });

    expect(result.eventId).toBe("evt_test_123");
    expect(result.type).toBe("checkout.session.completed");
    expect((result.data as { id: string }).id).toBe("cs_test_456");
  });

  it("rejects a signature produced with the wrong secret", () => {
    const payload = JSON.stringify({ id: "evt_test_789", type: "checkout.session.completed", data: {} });
    const badSignature = sign(payload, "whsec_a_completely_different_secret");

    expect(() =>
      stripeProvider.verifyWebhook(payload, { "stripe-signature": badSignature }),
    ).toThrow();
  });

  it("rejects a payload that was tampered with after signing", () => {
    const original = JSON.stringify({ id: "evt_test_999", type: "checkout.session.completed", data: {} });
    const signature = sign(original);
    const tampered = original.replace("evt_test_999", "evt_test_000");

    expect(() =>
      stripeProvider.verifyWebhook(tampered, { "stripe-signature": signature }),
    ).toThrow();
  });

  it("rejects a missing signature header", () => {
    expect(() => stripeProvider.verifyWebhook("{}", {})).toThrow(PaymentProviderError);
  });
});
