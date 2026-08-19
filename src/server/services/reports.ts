import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface FinancialReport {
  currencyCode: string;
  grossSales: number;
  refunds: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  commission: number;
  tax: number;
  shipping: number;
  expenses: number;
  netProfit: number;
  /** Current ledger balance for this subject — only meaningful for a seller report. */
  payableBalance: number;
}

const FULFILLED_STATUSES = ["DELIVERED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"] as const;

async function sumLedger(where: Prisma.LedgerEntryWhereInput): Promise<number> {
  const result = await prisma.ledgerEntry.aggregate({ where, _sum: { amount: true } });
  return Number(result._sum.amount ?? 0);
}

function dateFilter(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) };
}

async function computeCogs(sellerId: string | undefined, currencyCode: string, range: DateRange) {
  const items = await prisma.orderItem.findMany({
    where: {
      sellerOrder: {
        ...(sellerId ? { sellerId } : {}),
        status: { in: [...FULFILLED_STATUSES] },
        order: { currencyCode, placedAt: dateFilter(range) },
      },
    },
    select: { quantity: true, unitCostPrice: true },
  });
  return items.reduce((sum, item) => sum + item.quantity * Number(item.unitCostPrice), 0);
}

async function computeExpenses(sellerId: string | null, currencyCode: string, range: DateRange) {
  const result = await prisma.expense.aggregate({
    where: { sellerId, currencyCode, incurredAt: dateFilter(range) },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

export async function getSellerFinancialReport(
  sellerId: string,
  currencyCode: string,
  range: DateRange = {},
): Promise<FinancialReport> {
  const createdAt = dateFilter(range);
  const base = { subjectType: "SELLER" as const, subjectId: sellerId, currencyCode, createdAt };

  const [grossSales, refunds, discounts, commission, tax, shipping, expenses, cogs, payableBalance] =
    await Promise.all([
      sumLedger({ ...base, type: "SALE" }),
      sumLedger({ ...base, type: "REFUND" }),
      sumLedger({ ...base, type: "DISCOUNT" }),
      sumLedger({ ...base, type: "COMMISSION" }),
      sumLedger({ ...base, type: "TAX" }),
      sumLedger({ ...base, type: "SHIPPING" }),
      computeExpenses(sellerId, currencyCode, range),
      computeCogs(sellerId, currencyCode, range),
      sumLedger({ subjectType: "SELLER", subjectId: sellerId, currencyCode }), // all-time, not range-filtered
    ]);

  const netSales = grossSales + refunds + discounts; // refunds/discounts are already negative
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit + commission - expenses; // commission is negative (a cost to the seller)

  return {
    currencyCode,
    grossSales,
    refunds,
    discounts,
    netSales,
    cogs,
    grossProfit,
    commission,
    tax,
    shipping,
    expenses,
    netProfit,
    payableBalance,
  };
}

export async function getPlatformFinancialReport(
  currencyCode: string,
  range: DateRange = {},
): Promise<FinancialReport> {
  const createdAt = dateFilter(range);
  const base = { subjectType: "PLATFORM" as const, currencyCode, createdAt };

  const [commissionRevenue, tax, expenses, cogs] = await Promise.all([
    sumLedger({ ...base, type: "COMMISSION" }),
    sumLedger({ ...base, type: "TAX" }),
    computeExpenses(null, currencyCode, range),
    computeCogs(undefined, currencyCode, range),
  ]);

  // "Gross sales" for the platform view is the full order value flowing
  // through the marketplace (every seller's SALE line) — the platform's
  // actual revenue is the commission it keeps, reported separately.
  const grossSales = await sumLedger({
    subjectType: "SELLER",
    type: "SALE",
    currencyCode,
    createdAt,
  });
  const refunds = await sumLedger({ subjectType: "SELLER", type: "REFUND", currencyCode, createdAt });
  const discounts = await sumLedger({ subjectType: "SELLER", type: "DISCOUNT", currencyCode, createdAt });
  const shipping = await sumLedger({ subjectType: "SELLER", type: "SHIPPING", currencyCode, createdAt });

  const netSales = grossSales + refunds + discounts;
  const grossProfit = commissionRevenue; // the platform's own gross margin is its commission take
  const netProfit = commissionRevenue - expenses;

  return {
    currencyCode,
    grossSales,
    refunds,
    discounts,
    netSales,
    cogs,
    grossProfit,
    commission: commissionRevenue,
    tax,
    shipping,
    expenses,
    netProfit,
    payableBalance: 0,
  };
}

export async function listCurrenciesWithLedgerActivity(subjectType: "SELLER" | "PLATFORM", subjectId?: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { subjectType, ...(subjectId !== undefined ? { subjectId } : {}) },
    select: { currencyCode: true },
    distinct: ["currencyCode"],
  });
  return rows.map((r) => r.currencyCode);
}
