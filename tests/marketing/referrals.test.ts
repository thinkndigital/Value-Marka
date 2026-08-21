import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  getOrCreateReferralCode,
  recordReferral,
  rewardReferralOnFirstOrder,
} from "@/server/services/referrals";

const PREFIX = "referral-test-";

let referrerId: string;
let referredId: string;
let secondReferredId: string;

beforeAll(async () => {
  const [referrer, referred, secondReferred] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}referrer-${Date.now()}@example.com`,
        firstName: "Referrer",
        lastName: "Tester",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}referred-${Date.now()}@example.com`,
        firstName: "Referred",
        lastName: "Tester",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}referred2-${Date.now()}@example.com`,
        firstName: "Referred",
        lastName: "Two",
        passwordHash: "unused",
      },
    }),
  ]);
  referrerId = referrer.id;
  referredId = referred.id;
  secondReferredId = secondReferred.id;
});

afterAll(async () => {
  await prisma.referral.deleteMany({ where: { referrerId } });
  await prisma.referralCode.deleteMany({ where: { userId: referrerId } });
  await prisma.user.deleteMany({ where: { id: { in: [referrerId, referredId, secondReferredId] } } });
  await prisma.$disconnect();
});

describe("referral program", () => {
  it("creates a stable referral code for a user, reusing it on repeat calls", async () => {
    const first = await getOrCreateReferralCode(referrerId);
    const second = await getOrCreateReferralCode(referrerId);
    expect(second.code).toBe(first.code);
  });

  it("refuses self-referral", async () => {
    const code = await getOrCreateReferralCode(referrerId);
    const result = await recordReferral(referrerId, code.code);
    expect(result).toBeNull();
  });

  it("records a referral and rejects an unknown code", async () => {
    const code = await getOrCreateReferralCode(referrerId);
    const referral = await recordReferral(referredId, code.code);
    expect(referral?.referrerId).toBe(referrerId);
    expect(referral?.status).toBe("PENDING");

    const bogus = await recordReferral(secondReferredId, "NOT-A-REAL-CODE");
    expect(bogus).toBeNull();
  });

  it("only allows one referral per referred user", async () => {
    const code = await getOrCreateReferralCode(referrerId);
    const duplicate = await recordReferral(referredId, code.code);
    expect(duplicate).toBeNull();

    const count = await prisma.referral.count({ where: { referredId } });
    expect(count).toBe(1);
  });

  it("marks the referral REWARDED on the referred user's first order", async () => {
    const rewarded = await rewardReferralOnFirstOrder(referredId);
    expect(rewarded?.status).toBe("REWARDED");

    // Calling it again is a no-op — status is no longer PENDING.
    const again = await rewardReferralOnFirstOrder(referredId);
    expect(again).toBeNull();
  });
});
