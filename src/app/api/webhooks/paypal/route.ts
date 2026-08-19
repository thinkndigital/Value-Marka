import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { verifyPaypalWebhookAsync } from "@/server/payments/paypal";
import { PaymentProviderError } from "@/server/payments/PaymentProvider";
import { markOrderPaid } from "@/server/services/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = await verifyPaypalWebhookAsync(rawBody, {
      transmissionId: request.headers.get("paypal-transmission-id") ?? "",
      transmissionTime: request.headers.get("paypal-transmission-time") ?? "",
      certUrl: request.headers.get("paypal-cert-url") ?? "",
      authAlgo: request.headers.get("paypal-auth-algo") ?? "",
      transmissionSig: request.headers.get("paypal-transmission-sig") ?? "",
    });
  } catch (err) {
    const message = err instanceof PaymentProviderError ? err.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.eventId } });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ received: true, alreadyProcessed: true });
  }

  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        provider: "paypal",
        eventId: event.eventId,
        eventType: event.type,
        payload: event.data as object,
        status: "RECEIVED",
      },
    }));

  try {
    if (event.type === "PAYMENT.CAPTURE.COMPLETED" || event.type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.data as {
        id: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
      };
      const orderRef = resource.supplementary_data?.related_ids?.order_id ?? resource.id;
      await markOrderPaid("PAYPAL", orderRef);
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
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
