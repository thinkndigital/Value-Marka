import "server-only";
import type { PaymentProviderType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { stripeProvider } from "@/server/payments/stripe";
import { paypalProvider } from "@/server/payments/paypal";
import type { PaymentProvider } from "@/server/payments/PaymentProvider";
import { resolveCommissionRate } from "./commission";
import { confirmSellerOrdersOnPayment } from "./orders";

export class PaymentError extends Error {}

function getProvider(type: PaymentProviderType): PaymentProvider {
  return type === "STRIPE" ? stripeProvider : paypalProvider;
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new PaymentError("NEXT_PUBLIC_APP_URL is not configured.");
  return url;
}

async function getCurrencyDecimalDigits(currencyCode: string): Promise<number> {
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  return currency?.decimalDigits ?? 2;
}

/** Starts a hosted checkout for an order's full grandTotal. Called right after placeOrder(). */
export async function initiateOnlinePayment(
  orderId: string,
  providerType: PaymentProviderType,
  locale: string,
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const existing = await prisma.payment.findFirst({
    where: { orderId, status: { in: ["PENDING", "AUTHORIZED", "CAPTURED"] } },
  });
  if (existing) throw new PaymentError("This order already has a payment in progress.");

  const decimalDigits = await getCurrencyDecimalDigits(order.currencyCode);
  const provider = getProvider(providerType);

  const { providerRef, redirectUrl } = await provider.createIntent({
    orderId,
    amount: Number(order.grandTotal),
    currencyCode: order.currencyCode,
    currencyDecimalDigits: decimalDigits,
    description: `Value Marka order ${order.orderNumber}`,
    successUrl: `${appUrl()}/${locale}/account/orders/${order.orderNumber}?payment=success`,
    cancelUrl: `${appUrl()}/${locale}/checkout?payment=cancelled`,
  });

  await prisma.payment.create({
    data: {
      orderId,
      provider: providerType,
      providerRef,
      status: "PENDING",
      amount: order.grandTotal,
      currencyCode: order.currencyCode,
    },
  });

  return redirectUrl;
}

/**
 * Posts the real financial consequences of a captured payment: commission
 * resolved per line item, SALE/COMMISSION/TAX/SHIPPING ledger entries, and
 * auto-confirms every still-PENDING SellerOrder — payment received is what
 * tells a seller they can start fulfilling (DATABASE.md §6/§7).
 */
async function postCaptureLedger(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      sellerOrders: { include: { items: { include: { product: true } } } },
    },
  });

  for (const sellerOrder of order.sellerOrders) {
    let commissionAmount = 0;
    for (const item of sellerOrder.items) {
      const rate = await resolveCommissionRate(
        sellerOrder.sellerId,
        item.product.categoryId,
        item.productId,
      );
      commissionAmount += Number(item.lineTotal) * rate;
    }
    commissionAmount = Math.round(commissionAmount * 100) / 100;

    const payoutAmount =
      Number(sellerOrder.subtotal) - Number(sellerOrder.discountShare) - commissionAmount;

    await tx.sellerOrder.update({
      where: { id: sellerOrder.id },
      data: { commissionAmount, payoutAmount },
    });

    await tx.ledgerEntry.createMany({
      data: [
        {
          type: "SALE",
          amount: sellerOrder.subtotal,
          currencyCode: order.currencyCode,
          subjectType: "SELLER",
          subjectId: sellerOrder.sellerId,
          referenceType: "SellerOrder",
          referenceId: sellerOrder.id,
          description: `Sale — order ${order.orderNumber}`,
        },
        {
          type: "COMMISSION",
          amount: -commissionAmount,
          currencyCode: order.currencyCode,
          subjectType: "SELLER",
          subjectId: sellerOrder.sellerId,
          referenceType: "SellerOrder",
          referenceId: sellerOrder.id,
          description: `Platform commission — order ${order.orderNumber}`,
        },
        {
          type: "COMMISSION",
          amount: commissionAmount,
          currencyCode: order.currencyCode,
          subjectType: "PLATFORM",
          subjectId: null,
          referenceType: "SellerOrder",
          referenceId: sellerOrder.id,
          description: `Commission revenue — order ${order.orderNumber}`,
        },
        ...(Number(sellerOrder.shippingShare) > 0
          ? [
              {
                type: "SHIPPING" as const,
                amount: sellerOrder.shippingShare,
                currencyCode: order.currencyCode,
                subjectType: "SELLER",
                subjectId: sellerOrder.sellerId,
                referenceType: "SellerOrder",
                referenceId: sellerOrder.id,
                description: `Shipping remitted — order ${order.orderNumber}`,
              },
            ]
          : []),
        ...(Number(sellerOrder.taxShare) > 0
          ? [
              {
                type: "TAX" as const,
                amount: sellerOrder.taxShare,
                currencyCode: order.currencyCode,
                subjectType: "PLATFORM",
                subjectId: null,
                referenceType: "SellerOrder",
                referenceId: sellerOrder.id,
                description: `Tax collected, pending remittance — order ${order.orderNumber}`,
              },
            ]
          : []),
      ],
    });
  }

  await confirmSellerOrdersOnPayment(tx, orderId);
}

/**
 * The webhook handler's entry point. Re-verifies capture status against the
 * provider itself rather than trusting the webhook payload's claims, then
 * posts ledger entries and confirms orders exactly once (guarded by
 * Payment.status, in addition to the WebhookEvent idempotency check
 * upstream).
 */
export async function markOrderPaid(providerType: PaymentProviderType, providerRef: string) {
  const payment = await prisma.payment.findFirst({ where: { provider: providerType, providerRef } });
  if (!payment) throw new PaymentError(`No Payment found for ${providerType} ref ${providerRef}.`);
  if (payment.status === "CAPTURED") return; // already processed

  const decimalDigits = await getCurrencyDecimalDigits(payment.currencyCode);
  const provider = getProvider(providerType);
  const capture = await provider.capture(providerRef, decimalDigits);

  if (capture.status !== "CAPTURED") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED" } });
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        type: "CAPTURE",
        amount: capture.capturedAmount,
        providerRef: capture.providerRef,
        rawPayload: capture.rawPayload as Prisma.InputJsonValue,
      },
    });
    await postCaptureLedger(tx, payment.orderId);
  });
}

/**
 * Called from the seller order-refund action when the parent order was
 * paid online — issues a real refund through the provider and reverses the
 * SALE/COMMISSION ledger entries. Returns null (a no-op) for a COD order
 * with no captured Payment, so the caller falls back to recording the
 * refund as a manual/offline settlement.
 */
export async function refundSellerOrder(sellerOrderId: string) {
  const sellerOrder = await prisma.sellerOrder.findUniqueOrThrow({
    where: { id: sellerOrderId },
    include: { order: true, refunds: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = await prisma.payment.findFirst({
    where: { orderId: sellerOrder.orderId, status: "CAPTURED" },
  });
  if (!payment) return null;

  const refundRow = sellerOrder.refunds[0];
  const amount = Number(refundRow?.amount ?? sellerOrder.subtotal);
  const decimalDigits = await getCurrencyDecimalDigits(payment.currencyCode);
  const provider = getProvider(payment.provider);

  const result = await provider.refund({
    providerRef: payment.providerRef ?? "",
    amount,
    currencyDecimalDigits: decimalDigits,
    reason: refundRow?.reason ?? undefined,
  });

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        type: "REFUND",
        amount: result.amount,
        providerRef: result.providerRef,
      },
    });

    const totalRefunded = await tx.paymentTransaction.aggregate({
      where: { paymentId: payment.id, type: "REFUND" },
      _sum: { amount: true },
    });
    const fullyRefunded = Number(totalRefunded._sum.amount ?? 0) >= Number(payment.amount);
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    await tx.ledgerEntry.createMany({
      data: [
        {
          type: "REFUND",
          amount: -amount,
          currencyCode: payment.currencyCode,
          subjectType: "SELLER",
          subjectId: sellerOrder.sellerId,
          referenceType: "SellerOrder",
          referenceId: sellerOrder.id,
          description: `Refund — order ${sellerOrder.order.orderNumber}`,
        },
        {
          type: "COMMISSION",
          amount: -Number(sellerOrder.commissionAmount),
          currencyCode: payment.currencyCode,
          subjectType: "PLATFORM",
          subjectId: null,
          referenceType: "SellerOrder",
          referenceId: sellerOrder.id,
          description: `Commission reversed on refund — order ${sellerOrder.order.orderNumber}`,
        },
      ],
    });
  });

  return result;
}
