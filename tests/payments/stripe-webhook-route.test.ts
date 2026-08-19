import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/server/db";
import { POST } from "@/app/api/webhooks/stripe/route";

// Route-level behavior that doesn't require a live Stripe account: bad
// signatures are rejected before anything is persisted, a webhook event id
// that's already marked PROCESSED is acknowledged without being
// reprocessed, and a new event for a Payment that doesn't exist fails
// loudly (WebhookEvent.status FAILED) rather than being silently dropped.
// (A genuine capture success additionally calls provider.capture(), a real
// network call to Stripe, which can't be exercised here — see
// stripe-webhook.test.ts for the local, network-free signature checks this
// route relies on.)

const TEST_WEBHOOK_SECRET = "whsec_test_secret_for_route_test_only";
const PREFIX = "stripe-webhook-route-test-";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_never_used_for_a_real_api_call";
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

function sign(payload: string) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: TEST_WEBHOOK_SECRET });
}

function makeRequest(payload: string, signature?: string) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("POST /api/webhooks/stripe", () => {
  it("rejects a badly signed request with 400 and persists nothing", async () => {
    const eventId = `${PREFIX}bad-sig`;
    const payload = JSON.stringify({ id: eventId, type: "checkout.session.completed", data: {} });

    const response = await POST(makeRequest(payload, "v1=not-a-real-signature"));
    expect(response.status).toBe(400);

    const stored = await prisma.webhookEvent.findUnique({ where: { eventId } });
    expect(stored).toBeNull();
  });

  it("acknowledges an already-processed event without reprocessing it", async () => {
    const eventId = `${PREFIX}duplicate`;
    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId,
        eventType: "checkout.session.completed",
        payload: { id: "cs_does_not_exist" },
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: { id: "cs_does_not_exist" } },
    });

    const response = await POST(makeRequest(payload, sign(payload)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alreadyProcessed).toBe(true);

    // Still exactly one row, still PROCESSED — proves markOrderPaid (which
    // would fail loudly for a nonexistent Payment) was never called again.
    const stored = await prisma.webhookEvent.findUnique({ where: { eventId } });
    expect(stored?.status).toBe("PROCESSED");
  });

  it("records a new event and marks it FAILED when markOrderPaid finds no matching Payment", async () => {
    const eventId = `${PREFIX}new-event-no-matching-payment`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: { id: "cs_does_not_exist" } },
    });

    const response = await POST(makeRequest(payload, sign(payload)));
    expect(response.status).toBe(500);

    const stored = await prisma.webhookEvent.findUnique({ where: { eventId } });
    expect(stored?.status).toBe("FAILED");
    expect(stored?.error).toBeTruthy();
  });
});
