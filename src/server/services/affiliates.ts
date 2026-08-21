import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";

export class AffiliateError extends Error {}

export async function applyToBeAffiliate(userId: string) {
  const existing = await prisma.affiliate.findUnique({ where: { userId } });
  if (existing) throw new AffiliateError("You've already applied to the affiliate program.");

  const code = randomUUID().slice(0, 8);
  return prisma.affiliate.create({ data: { userId, affiliateCode: code, status: "PENDING" } });
}

export async function approveAffiliate(affiliateId: string) {
  return prisma.affiliate.update({ where: { id: affiliateId }, data: { status: "APPROVED" } });
}

export async function suspendAffiliate(affiliateId: string) {
  return prisma.affiliate.update({ where: { id: affiliateId }, data: { status: "SUSPENDED" } });
}

export function listAffiliatesForAdmin() {
  return prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });
}

export function getAffiliateForUser(userId: string) {
  return prisma.affiliate.findUnique({ where: { userId } });
}

interface CreateLinkInput {
  targetUrl: string;
  campaignId?: string;
}

export async function createAffiliateLink(affiliateId: string, input: CreateLinkInput) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate || affiliate.status !== "APPROVED") {
    throw new AffiliateError("Only an approved affiliate can create links.");
  }
  const slug = randomUUID().slice(0, 10);
  return prisma.affiliateLink.create({
    data: { affiliateId, targetUrl: input.targetUrl, slug, campaignId: input.campaignId },
  });
}

export function listAffiliateLinks(affiliateId: string) {
  return prisma.affiliateLink.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } });
}

export async function listAffiliateStats(affiliateId: string) {
  const [clicks, conversions, commissionSum] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateConversion.count({ where: { affiliateId, stage: "PURCHASE" } }),
    prisma.ledgerEntry.aggregate({
      where: { subjectType: "AFFILIATE", subjectId: affiliateId, type: "AFFILIATE_COMMISSION" },
      _sum: { amount: true },
    }),
  ]);
  return {
    clicks,
    conversions,
    totalCommission: Number(commissionSum._sum.amount ?? 0),
  };
}

/** Called by the /go/[slug] redirect route — records the click and returns where to send the visitor. */
export async function recordAffiliateClick(
  slug: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const link = await prisma.affiliateLink.findUnique({ where: { slug } });
  if (!link) throw new AffiliateError("This affiliate link doesn't exist.");

  const click = await prisma.affiliateClick.create({
    data: {
      affiliateId: link.affiliateId,
      linkId: link.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { id: link.affiliateId } });
  return { targetUrl: link.targetUrl, clickId: click.id, affiliateId: link.affiliateId, cookieDays: affiliate.cookieDays };
}

export interface AffiliateAttribution {
  affiliateId: string;
  clickId: string;
}

/**
 * Records a purchase conversion and credits the affiliate's ledger balance
 * for real — called from checkout right after an order is placed, when the
 * customer arrived via a cookied affiliate link.
 */
export async function recordAffiliateConversion(
  attribution: AffiliateAttribution,
  orderId: string,
  orderSubtotal: number,
  currencyCode: string,
) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: attribution.affiliateId } });
  if (!affiliate || affiliate.status !== "APPROVED") return null;

  const alreadyClaimed = await prisma.affiliateConversion.findUnique({
    where: { clickId: attribution.clickId },
  });
  if (alreadyClaimed) return null;

  const commissionAmount = affiliate.fixedCommission
    ? Number(affiliate.fixedCommission)
    : Math.round(orderSubtotal * Number(affiliate.commissionRate ?? 0) * 100) / 100;

  return prisma.$transaction(async (tx) => {
    const conversion = await tx.affiliateConversion.create({
      data: {
        affiliateId: attribution.affiliateId,
        clickId: attribution.clickId,
        orderId,
        stage: "PURCHASE",
        commissionAmount,
      },
    });

    if (commissionAmount > 0) {
      await tx.ledgerEntry.create({
        data: {
          type: "AFFILIATE_COMMISSION",
          amount: commissionAmount,
          currencyCode,
          subjectType: "AFFILIATE",
          subjectId: attribution.affiliateId,
          referenceType: "Order",
          referenceId: orderId,
          description: "Affiliate commission",
        },
      });
    }

    return conversion;
  });
}
