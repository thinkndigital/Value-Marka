import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";

export class ReferralError extends Error {}

/**
 * Platform-wide default reward for a successful referral — there is no
 * admin-configurable referral-settings model yet (unlike commission, which
 * has `CommissionRule`), so this constant is the one place that decision
 * lives until such a model exists.
 */
export const DEFAULT_REFERRAL_REWARD = { type: "FIXED" as const, value: 5 };

export async function getOrCreateReferralCode(userId: string) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing;

  const code = randomBytes(4).toString("hex").toUpperCase();
  return prisma.referralCode.create({ data: { userId, code } });
}

/** Called right after a new user registers, if they arrived with a referral code. */
export async function recordReferral(referredUserId: string, referralCode: string) {
  const code = await prisma.referralCode.findUnique({ where: { code: referralCode.trim().toUpperCase() } });
  if (!code) return null;
  if (code.userId === referredUserId) return null; // no self-referral

  const existing = await prisma.referral.findUnique({ where: { referredId: referredUserId } });
  if (existing) return null;

  return prisma.referral.create({
    data: {
      referrerId: code.userId,
      referredId: referredUserId,
      rewardType: DEFAULT_REFERRAL_REWARD.type === "FIXED" ? "FIXED" : "PERCENTAGE",
      rewardValue: DEFAULT_REFERRAL_REWARD.value,
      status: "PENDING",
    },
  });
}

/**
 * Called from checkout when an order is a customer's first — marks the
 * referral REWARDED. Applying the reward as usable account credit needs a
 * customer-credit/wallet model that doesn't exist in the schema yet, so
 * this records the reward as earned without a redemption mechanism; see
 * IMPLEMENTATION_PLAN.md Phase 7.
 */
export async function rewardReferralOnFirstOrder(referredUserId: string) {
  const referral = await prisma.referral.findUnique({ where: { referredId: referredUserId } });
  if (!referral || referral.status !== "PENDING") return null;

  return prisma.referral.update({ where: { id: referral.id }, data: { status: "REWARDED" } });
}

export function listReferralsForUser(userId: string) {
  return prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    include: { referred: { select: { firstName: true, lastName: true } } },
  });
}
