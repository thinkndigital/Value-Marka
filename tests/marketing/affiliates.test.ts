import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  applyToBeAffiliate,
  approveAffiliate,
  createAffiliateLink,
  recordAffiliateClick,
  recordAffiliateConversion,
  AffiliateError,
} from "@/server/services/affiliates";

// Affiliate conversions post a real LedgerEntry (subjectType AFFILIATE) —
// this checks click → conversion → ledger crediting end-to-end, plus the
// double-claim guard on AffiliateConversion.clickId's uniqueness.

const PREFIX = "affiliate-test-";

let affiliateUserId: string;
let affiliateId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Affiliate",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });
  affiliateUserId = user.id;

  const affiliate = await applyToBeAffiliate(affiliateUserId);
  affiliateId = affiliate.id;
});

afterAll(async () => {
  await prisma.affiliateConversion.deleteMany({ where: { affiliateId } });
  await prisma.affiliateClick.deleteMany({ where: { affiliateId } });
  await prisma.affiliateLink.deleteMany({ where: { affiliateId } });
  await prisma.ledgerEntry.deleteMany({ where: { subjectType: "AFFILIATE", subjectId: affiliateId } });
  await prisma.affiliate.deleteMany({ where: { id: affiliateId } });
  await prisma.user.deleteMany({ where: { id: affiliateUserId } });
  await prisma.$disconnect();
});

describe("affiliate program", () => {
  it("won't let a PENDING affiliate create links", async () => {
    await expect(
      createAffiliateLink(affiliateId, { targetUrl: "/search" }),
    ).rejects.toBeInstanceOf(AffiliateError);
  });

  it("records a click, then a conversion that credits a real ledger entry", async () => {
    await approveAffiliate(affiliateId);
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: { fixedCommission: "7.50" },
    });

    const link = await createAffiliateLink(affiliateId, { targetUrl: "/search" });
    const click = await recordAffiliateClick(link.slug, { ipAddress: "127.0.0.1" });
    expect(click.affiliateId).toBe(affiliateId);

    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-${Date.now()}`,
        userId: affiliateUserId,
        status: "PENDING",
        currencyCode: "USD",
        subtotal: "100.00",
        grandTotal: "100.00",
      },
    });

    const conversion = await recordAffiliateConversion(
      { affiliateId, clickId: click.clickId },
      order.id,
      100,
      "USD",
    );
    expect(conversion?.commissionAmount?.toString()).toBe("7.5");

    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: { subjectType: "AFFILIATE", subjectId: affiliateId, referenceId: order.id },
    });
    expect(ledgerEntry?.amount.toString()).toBe("7.5");

    await prisma.order.delete({ where: { id: order.id } });
  });

  it("refuses to double-claim the same click", async () => {
    const link = await createAffiliateLink(affiliateId, { targetUrl: "/search" });
    const click = await recordAffiliateClick(link.slug, {});

    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order2-${Date.now()}`,
        userId: affiliateUserId,
        status: "PENDING",
        currencyCode: "USD",
        subtotal: "50.00",
        grandTotal: "50.00",
      },
    });

    const first = await recordAffiliateConversion(
      { affiliateId, clickId: click.clickId },
      order.id,
      50,
      "USD",
    );
    expect(first).not.toBeNull();

    const second = await recordAffiliateConversion(
      { affiliateId, clickId: click.clickId },
      order.id,
      50,
      "USD",
    );
    expect(second).toBeNull();

    const conversions = await prisma.affiliateConversion.count({ where: { clickId: click.clickId } });
    expect(conversions).toBe(1);

    await prisma.order.delete({ where: { id: order.id } });
  });
});
