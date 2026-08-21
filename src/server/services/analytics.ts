import "server-only";
import { prisma } from "@/server/db";
import { dateFilter, computeCogs, type DateRange } from "@/server/services/reports";

/** Small helper so callers (server components) don't call Date.now() directly during render. */
export function daysAgoRange(days: number): DateRange {
  return { from: new Date(Date.now() - days * 86400_000) };
}

export interface SalesTrendPoint {
  date: string;
  grossSales: number;
  orderCount: number;
}

/**
 * Buckets real SALE ledger entries (posted when a payment is captured —
 * DATABASE.md §6) by the day they were posted. `sellerId` scopes to one
 * seller's own sales; omit it for the platform-wide trend. `orderCount`
 * counts distinct SellerOrders (the ledger's referenceId for a SALE row),
 * not customer-facing Orders — a multi-seller cart posts one SALE row per
 * seller, which is the right unit for a per-seller trend too.
 */
export async function getSalesTrend(
  currencyCode: string,
  days: number,
  sellerId?: string,
): Promise<SalesTrendPoint[]> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      subjectType: "SELLER",
      ...(sellerId ? { subjectId: sellerId } : {}),
      type: "SALE",
      currencyCode,
      createdAt: { gte: from },
    },
    select: { amount: true, createdAt: true, referenceId: true },
  });

  const buckets = new Map<string, { grossSales: number; orderIds: Set<string> }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { grossSales: 0, orderIds: new Set() });
  }

  for (const entry of entries) {
    const key = entry.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.grossSales += Number(entry.amount);
    if (entry.referenceId) bucket.orderIds.add(entry.referenceId);
  }

  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    grossSales: Math.round(bucket.grossSales * 100) / 100,
    orderCount: bucket.orderIds.size,
  }));
}

/** Current stock valued at cost — see getInventoryTurnover for the averaging caveat. */
export async function getInventoryValue(currencyCode: string, sellerId?: string): Promise<number> {
  const inventories = await prisma.inventory.findMany({
    where: { product: { currencyCode, ...(sellerId ? { sellerId } : {}) } },
    select: { quantity: true, product: { select: { costPrice: true } } },
  });
  return inventories.reduce((sum, inv) => sum + inv.quantity * Number(inv.product.costPrice), 0);
}

export interface InventoryTurnover {
  cogs: number;
  inventoryValue: number;
  /** cogs / inventoryValue over the period — null when there's no stock on hand to divide by. */
  turnoverRatio: number | null;
}

/**
 * Turnover = period COGS ÷ inventory value. This uses *current* inventory
 * value as the denominator rather than a beginning/ending average, since
 * the schema doesn't keep historical stock-value snapshots — a real
 * limitation, not a fabricated number; documented here rather than papered
 * over with a fake average.
 */
export async function getInventoryTurnover(
  currencyCode: string,
  range: DateRange,
  sellerId?: string,
): Promise<InventoryTurnover> {
  const [cogs, inventoryValue] = await Promise.all([
    computeCogs(sellerId, currencyCode, range),
    getInventoryValue(currencyCode, sellerId),
  ]);
  return {
    cogs: Math.round(cogs * 100) / 100,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    turnoverRatio: inventoryValue > 0 ? Math.round((cogs / inventoryValue) * 100) / 100 : null,
  };
}

export interface SellerGmvEntry {
  sellerId: string;
  storeName: string;
  gmv: number;
}

/** Ranks sellers by gross SALE ledger total in the period — real Gross Merchandise Value, not order count. */
export async function getSellerGmvLeaderboard(
  currencyCode: string,
  range: DateRange,
  limit = 10,
): Promise<SellerGmvEntry[]> {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["subjectId"],
    where: { subjectType: "SELLER", type: "SALE", currencyCode, createdAt: dateFilter(range) },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  const sellerIds = grouped.map((g) => g.subjectId).filter((id): id is string => Boolean(id));
  const sellers = await prisma.seller.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, storeName: true },
  });
  const nameById = new Map(sellers.map((s) => [s.id, s.storeName]));

  return grouped
    .filter((g): g is typeof g & { subjectId: string } => Boolean(g.subjectId))
    .map((g) => ({
      sellerId: g.subjectId,
      storeName: nameById.get(g.subjectId) ?? "Unknown seller",
      gmv: Math.round(Number(g._sum.amount ?? 0) * 100) / 100,
    }));
}

export interface ProductRevenueEntry {
  productId: string;
  name: string;
  revenue: number;
  quantitySold: number;
}

/** Top products by revenue for one seller, from real delivered OrderItem lines. */
export async function getTopProductsBySeller(
  sellerId: string,
  range: DateRange,
  limit = 10,
): Promise<ProductRevenueEntry[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      sellerOrder: {
        sellerId,
        status: { in: ["DELIVERED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"] },
        order: { placedAt: dateFilter(range) },
      },
    },
    select: { productId: true, nameSnapshot: true, quantity: true, lineTotal: true },
  });

  const byProduct = new Map<string, { name: string; revenue: number; quantitySold: number }>();
  for (const item of items) {
    const existing = byProduct.get(item.productId) ?? {
      name: item.nameSnapshot,
      revenue: 0,
      quantitySold: 0,
    };
    existing.revenue += Number(item.lineTotal);
    existing.quantitySold += item.quantity;
    byProduct.set(item.productId, existing);
  }

  return Array.from(byProduct.entries())
    .map(([productId, v]) => ({ productId, ...v, revenue: Math.round(v.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface CouponPerformance {
  redemptions: number;
  totalDiscount: number;
  orderRevenue: number;
}

/**
 * Reports real totals only — deliberately does not claim a "% ROI" or
 * incremental-lift figure, since that would require a control group
 * (orders that would have happened anyway) this platform has no way to
 * observe. `orderRevenue` ÷ `totalDiscount` is a plain ratio of revenue
 * transacted per discount dollar given, not a causal claim.
 */
export async function getCouponPerformance(currencyCode: string, range: DateRange): Promise<CouponPerformance> {
  const orders = await prisma.order.findMany({
    where: {
      couponId: { not: null },
      currencyCode,
      placedAt: dateFilter(range),
      status: { not: "CANCELLED" },
    },
    select: { discountTotal: true, grandTotal: true },
  });

  return {
    redemptions: orders.length,
    totalDiscount: Math.round(orders.reduce((sum, o) => sum + Number(o.discountTotal), 0) * 100) / 100,
    orderRevenue: Math.round(orders.reduce((sum, o) => sum + Number(o.grandTotal), 0) * 100) / 100,
  };
}

export interface AffiliatePerformance {
  conversions: number;
  commissionPaid: number;
  orderRevenue: number;
}

/** Same honesty rule as coupon performance: real totals, no fabricated ROI. */
export async function getAffiliatePerformance(
  currencyCode: string,
  range: DateRange,
): Promise<AffiliatePerformance> {
  const conversions = await prisma.affiliateConversion.findMany({
    where: { stage: "PURCHASE", createdAt: dateFilter(range) },
    select: { commissionAmount: true, orderId: true },
  });

  const orderIds = conversions.map((c) => c.orderId).filter((id): id is string => Boolean(id));
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, currencyCode },
    select: { grandTotal: true },
  });

  return {
    conversions: conversions.length,
    commissionPaid: Math.round(conversions.reduce((sum, c) => sum + Number(c.commissionAmount ?? 0), 0) * 100) / 100,
    orderRevenue: Math.round(orders.reduce((sum, o) => sum + Number(o.grandTotal), 0) * 100) / 100,
  };
}
