import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { stripeProvider } from "@/server/payments/stripe";
import { PaymentProviderError } from "@/server/payments/PaymentProvider";
import { markOrderPaid } from "@/server/services/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = stripeProvider.verifyWebhook(rawBody, {
      "stripe-signature": request.headers.get("stripe-signature") ?? undefined,
    });
  } catch (err) {
    const message = err instanceof PaymentProviderError ? err.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: a redelivered event is acknowledged without reprocessing.
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.eventId } });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ received: true, alreadyProcessed: true });
  }

  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId: event.eventId,
        eventType: event.type,
        payload: event.data as object,
        status: "RECEIVED",
      },
    }));

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data as { id: string };
      await markOrderPaid("STRIPE", session.id);
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown error" },
    });
    // 500 so Stripe retries — this is an unexpected processing failure, not
    // a signal that the event should be dropped.
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
