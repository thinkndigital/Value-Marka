import "server-only";
import { prisma } from "@/server/db";
import { stripeProvider } from "@/server/payments/stripe";
import { paypalProvider } from "@/server/payments/paypal";
import type { PaymentProvider } from "@/server/payments/PaymentProvider";
import { sendEmailNotification } from "@/server/notifications/send";
import { payoutReleasedEmail } from "@/server/notifications/templates";

export class PayoutError extends Error {}

const OPEN_PAYOUT_STATUSES = ["PENDING", "APPROVED", "PROCESSING"] as const;

/** SUM(LedgerEntry) for this seller, minus payouts already requested but not yet released. */
export async function getSellerAvailableBalance(sellerId: string, currencyCode: string) {
  const [ledger, openPayouts] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { subjectType: "SELLER", subjectId: sellerId, currencyCode },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { sellerId, currencyCode, status: { in: [...OPEN_PAYOUT_STATUSES] } },
      _sum: { amount: true },
    }),
  ]);

  const ledgerBalance = Number(ledger._sum.amount ?? 0);
  const alreadyRequested = Number(openPayouts._sum?.amount ?? 0);
  return Math.round((ledgerBalance - alreadyRequested) * 100) / 100;
}

export async function requestPayout(sellerId: string, amount: number, currencyCode: string, method: string) {
  if (amount <= 0) throw new PayoutError("Enter an amount greater than zero.");

  const available = await getSellerAvailableBalance(sellerId, currencyCode);
  if (amount > available) {
    throw new PayoutError(`Only ${available} ${currencyCode} is available to withdraw.`);
  }

  return prisma.payout.create({
    data: { sellerId, amount, currencyCode, method, status: "PENDING" },
  });
}

export async function listSellerCurrencies(sellerId: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { subjectType: "SELLER", subjectId: sellerId },
    select: { currencyCode: true },
    distinct: ["currencyCode"],
  });
  return rows.map((r) => r.currencyCode);
}

export function listPayoutsForSeller(sellerId: string) {
  return prisma.payout.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" } });
}

export function listPayoutsForAdmin(status?: (typeof OPEN_PAYOUT_STATUSES)[number] | "PAID" | "REJECTED" | "ON_HOLD") {
  return prisma.payout.findMany({
    where: status ? { status } : {},
    orderBy: { requestedAt: "desc" },
    include: { seller: { select: { storeName: true, stripeAccountId: true, paypalMerchantId: true } } },
  });
}

export async function approvePayout(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (!["PENDING", "ON_HOLD"].includes(payout.status)) {
    throw new PayoutError("Only a pending or held payout can be approved.");
  }
  return prisma.payout.update({ where: { id: payoutId }, data: { status: "APPROVED" } });
}

export async function holdPayout(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (!["PENDING", "APPROVED"].includes(payout.status)) {
    throw new PayoutError("Only a pending or approved payout can be put on hold.");
  }
  return prisma.payout.update({ where: { id: payoutId }, data: { status: "ON_HOLD" } });
}

export async function rejectPayout(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (!["PENDING", "APPROVED", "ON_HOLD"].includes(payout.status)) {
    throw new PayoutError("This payout can no longer be rejected.");
  }
  return prisma.payout.update({ where: { id: payoutId }, data: { status: "REJECTED" } });
}

function getProviderForMethod(method: string): PaymentProvider {
  return method === "PAYPAL" ? paypalProvider : stripeProvider;
}

/**
 * Actually moves money: calls the provider's transfer API against the
 * seller's connected account, then marks the Payout PAID and posts the
 * offsetting PAYOUT ledger entry. This is the only place a Payout's amount
 * leaves the platform's balance for real.
 */
export async function releasePayout(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
    include: { seller: { include: { user: { select: { id: true, email: true } } } } },
  });
  if (payout.status !== "APPROVED") {
    throw new PayoutError("Only an approved payout can be released.");
  }

  const accountId =
    payout.method === "PAYPAL" ? payout.seller.paypalMerchantId : payout.seller.stripeAccountId;
  if (!accountId) {
    throw new PayoutError(
      `This seller hasn't connected a ${payout.method === "PAYPAL" ? "PayPal" : "Stripe"} account yet.`,
    );
  }

  const currency = await prisma.currency.findUnique({ where: { code: payout.currencyCode } });
  const provider = getProviderForMethod(payout.method ?? "STRIPE");

  const transfer = await provider.transferToSeller({
    accountId,
    amount: Number(payout.amount),
    currencyCode: payout.currencyCode,
    currencyDecimalDigits: currency?.decimalDigits ?? 2,
    referenceType: "Payout",
    referenceId: payout.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payoutId },
      data: { status: "PAID", providerRef: transfer.providerRef, processedAt: new Date() },
    });
    await tx.ledgerEntry.create({
      data: {
        type: "PAYOUT",
        amount: -Number(payout.amount),
        currencyCode: payout.currencyCode,
        subjectType: "SELLER",
        subjectId: payout.sellerId,
        referenceType: "Payout",
        referenceId: payout.id,
        description: `Payout released — ${transfer.providerRef}`,
      },
    });
  });

  const email = payoutReleasedEmail({
    amount: payout.amount.toString(),
    currencyCode: payout.currencyCode,
    method: payout.method ?? "STRIPE",
  });
  sendEmailNotification({
    userId: payout.seller.user.id,
    to: payout.seller.user.email,
    type: "payout_released",
    subject: email.subject,
    html: email.html,
  });

  return payout;
}
