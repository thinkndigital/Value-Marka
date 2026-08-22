import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export class LoyaltyError extends Error {}

// A redemption below this floor would mint a coupon worth a few cents —
// not worth the row it creates. Deliberately a fixed constant rather than
// an admin setting, to keep the reward rule's shape (earn rate + redemption
// value) simple.
const MIN_REDEEM_POINTS = 100;

// ── Admin: reward rule ───────────────────────────────────────────────────
// Append-only and versioned by effectiveAt, exactly like ExchangeRate
// (src/server/services/currency.ts): a rule already used to earn or redeem
// points is never rewritten, so past LoyaltyTransactions keep the rate that
// was actually in effect. Only a not-yet-effective rule can be deleted.

export function listRewardRules() {
  return prisma.rewardRule.findMany({ orderBy: { effectiveAt: "desc" } });
}

export interface RewardRuleInput {
  pointsPerCurrencyUnit: number;
  redemptionValue: number;
  effectiveAt: Date;
}

export function createRewardRule(input: RewardRuleInput) {
  return prisma.rewardRule.create({ data: input });
}

export async function deleteRewardRule(id: string) {
  const existing = await prisma.rewardRule.findUnique({ where: { id } });
  if (!existing) throw new LoyaltyError("Reward rule not found.");
  if (existing.effectiveAt <= new Date()) {
    throw new LoyaltyError("This rule has already taken effect and can't be removed — add a new rule instead.");
  }
  await prisma.rewardRule.delete({ where: { id } });
}

export async function getEffectiveRewardRule(atDate: Date = new Date()) {
  return prisma.rewardRule.findFirst({
    where: { effectiveAt: { lte: atDate } },
    orderBy: { effectiveAt: "desc" },
  });
}

// ── Ledger ────────────────────────────────────────────────────────────────

async function getOrCreateAccount(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.loyaltyAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.loyaltyAccount.create({ data: { userId } });
}

export async function getLoyaltyAccount(userId: string) {
  return prisma.loyaltyAccount.findUnique({ where: { userId } });
}

export function listLoyaltyTransactions(userId: string) {
  return prisma.loyaltyTransaction.findMany({
    where: { account: { userId } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Earns points for a delivered order — the only code path allowed to
 * increment a balance. Called from orders.ts's DELIVERED transition inside
 * the same $transaction as the shipment/inventory updates, so a crash
 * between them can't leave stock converted but points unawarded (or vice
 * versa). Silently does nothing if no reward rule has ever been configured
 * — there is no fake default rate.
 */
export async function earnPointsForOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  orderSubtotal: number,
  reference: { referenceType: string; referenceId: string },
) {
  const rule = await tx.rewardRule.findFirst({
    where: { effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  if (!rule) return null;

  const points = Math.floor(orderSubtotal * Number(rule.pointsPerCurrencyUnit));
  if (points <= 0) return null;

  const account = await getOrCreateAccount(tx, userId);
  await tx.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      points,
      type: "EARNED",
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    },
  });
  return tx.loyaltyAccount.update({
    where: { id: account.id },
    data: { balance: { increment: points } },
  });
}

/**
 * Redeems points for a real, usable single-use platform coupon — reusing
 * the existing, already-tested coupon engine (checkout.ts's
 * validateCoupon/recordCouponUsage) rather than inventing a second discount
 * mechanism. The coupon and the REDEEMED ledger row are created in one
 * transaction, so a balance can never be debited without a coupon existing
 * to show for it, or vice versa.
 */
export async function redeemPoints(userId: string, points: number) {
  if (!Number.isInteger(points) || points < MIN_REDEEM_POINTS) {
    throw new LoyaltyError(`Redeem at least ${MIN_REDEEM_POINTS} points at a time.`);
  }

  const rule = await getEffectiveRewardRule();
  if (!rule) throw new LoyaltyError("Rewards aren't configured yet.");

  return prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.findUnique({ where: { userId } });
    if (!account || account.balance < points) {
      throw new LoyaltyError("You don't have enough points for this redemption.");
    }

    const value = Math.round(points * Number(rule.redemptionValue) * 100) / 100;
    const code = `RWD${randomBytes(5).toString("hex").toUpperCase()}`;

    const coupon = await tx.coupon.create({
      data: {
        code,
        type: "FIXED_AMOUNT",
        value,
        usageLimit: 1,
        isActive: true,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        points: -points,
        type: "REDEEMED",
        referenceType: "Coupon",
        referenceId: coupon.id,
        note: code,
      },
    });
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: { decrement: points } },
    });

    return coupon;
  });
}
