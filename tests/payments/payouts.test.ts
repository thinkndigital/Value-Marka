import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  getSellerAvailableBalance,
  requestPayout,
  approvePayout,
  holdPayout,
  rejectPayout,
  releasePayout,
  PayoutError,
} from "@/server/services/payouts";

// Payout balance derivation and the approve/hold/reject state machine —
// against the real database. releasePayout's actual provider transfer call
// needs live Stripe/PayPal credentials this environment doesn't have, but
// its pre-flight "seller has no connected account" guard runs before any
// network call and is real, testable code.

const PREFIX = "payouts-test-";

let sellerId: string;
let ledgerIds: string[] = [];

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Payout",
      lastName: "Seller",
      passwordHash: "unused",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Payout Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const entries = await prisma.ledgerEntry.createManyAndReturn({
    data: [
      { type: "SALE", amount: "100.00", currencyCode: "USD", subjectType: "SELLER", subjectId: sellerId },
      {
        type: "COMMISSION",
        amount: "-10.00",
        currencyCode: "USD",
        subjectType: "SELLER",
        subjectId: sellerId,
      },
    ],
  });
  ledgerIds = entries.map((e) => e.id);
});

afterAll(async () => {
  await prisma.payout.deleteMany({ where: { sellerId } });
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: ledgerIds } } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("getSellerAvailableBalance", () => {
  it("sums the seller's ledger entries", async () => {
    const balance = await getSellerAvailableBalance(sellerId, "USD");
    expect(balance).toBe(90);
  });

  it("subtracts payouts already requested but not yet released", async () => {
    const payout = await requestPayout(sellerId, 30, "USD", "STRIPE");
    const balance = await getSellerAvailableBalance(sellerId, "USD");
    expect(balance).toBe(60);

    await rejectPayout(payout.id); // give the balance back for later tests
    const restored = await getSellerAvailableBalance(sellerId, "USD");
    expect(restored).toBe(90);
  });
});

describe("requestPayout", () => {
  it("refuses to request more than the available balance", async () => {
    await expect(requestPayout(sellerId, 1000, "USD", "STRIPE")).rejects.toBeInstanceOf(PayoutError);
  });

  it("refuses a zero or negative amount", async () => {
    await expect(requestPayout(sellerId, 0, "USD", "STRIPE")).rejects.toBeInstanceOf(PayoutError);
  });
});

describe("the approve/hold/reject/release state machine", () => {
  it("moves PENDING → APPROVED → (blocked on release without a connected account)", async () => {
    const payout = await requestPayout(sellerId, 20, "USD", "STRIPE");
    expect(payout.status).toBe("PENDING");

    const approved = await approvePayout(payout.id);
    expect(approved.status).toBe("APPROVED");

    // This seller never connected a Stripe account (no stripeAccountId) —
    // releasePayout must refuse before attempting any provider call.
    await expect(releasePayout(payout.id)).rejects.toBeInstanceOf(PayoutError);

    await rejectPayout(payout.id);
  });

  it("refuses to approve a payout that isn't PENDING", async () => {
    const payout = await requestPayout(sellerId, 15, "USD", "STRIPE");
    await approvePayout(payout.id);
    await expect(approvePayout(payout.id)).rejects.toBeInstanceOf(PayoutError);
    await rejectPayout(payout.id);
  });

  it("can hold a pending payout and later approve or reject it", async () => {
    const payout = await requestPayout(sellerId, 10, "USD", "STRIPE");
    const held = await holdPayout(payout.id);
    expect(held.status).toBe("ON_HOLD");

    const approved = await approvePayout(payout.id);
    expect(approved.status).toBe("APPROVED");

    await holdPayout(payout.id);
    const rejected = await rejectPayout(payout.id);
    expect(rejected.status).toBe("REJECTED");
  });

  it("refuses to release a payout that isn't APPROVED", async () => {
    const payout = await requestPayout(sellerId, 5, "USD", "STRIPE");
    await expect(releasePayout(payout.id)).rejects.toBeInstanceOf(PayoutError);
    await rejectPayout(payout.id);
  });
});
