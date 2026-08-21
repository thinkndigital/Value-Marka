import "server-only";
import { prisma } from "@/server/db";
import { DEFAULT_PAGE_SIZE, paginate } from "@/server/pagination";

export interface CustomerProfile {
  userId: string;
  orderCount: number;
  lifetimeValue: number;
  averageOrderValue: number;
  lastOrderAt: Date | null;
  currencyCode: string | null;
}

/**
 * LTV/AOV are computed from real Order rows, grouped by currency (summing
 * across currencies would be meaningless) — this returns the customer's
 * primary currency (their most recent order's) rather than every currency
 * they've ever ordered in, which is enough for a CRM summary view.
 */
export async function getCustomerProfile(userId: string): Promise<CustomerProfile> {
  const orders = await prisma.order.findMany({
    where: { userId, status: { notIn: ["CANCELLED"] } },
    orderBy: { placedAt: "desc" },
    select: { grandTotal: true, currencyCode: true, placedAt: true },
  });

  if (orders.length === 0) {
    return {
      userId,
      orderCount: 0,
      lifetimeValue: 0,
      averageOrderValue: 0,
      lastOrderAt: null,
      currencyCode: null,
    };
  }

  const currencyCode = orders[0].currencyCode;
  const sameCurrencyOrders = orders.filter((o) => o.currencyCode === currencyCode);
  const lifetimeValue = sameCurrencyOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);

  return {
    userId,
    orderCount: orders.length,
    lifetimeValue: Math.round(lifetimeValue * 100) / 100,
    averageOrderValue: Math.round((lifetimeValue / sameCurrencyOrders.length) * 100) / 100,
    lastOrderAt: orders[0].placedAt,
    currencyCode,
  };
}

const CUSTOMER_WHERE = { roles: { some: { role: { key: "CUSTOMER" as const } } } };

/** Unbounded on purpose — evaluateSegment below needs every customer to check membership correctly, not just one page. */
export function listCustomers() {
  return prisma.user.findMany({
    where: CUSTOMER_WHERE,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
  });
}

/** Paginated variant for the /admin/customers listing UI. */
export async function listCustomersPage(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: CUSTOMER_WHERE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.user.count({ where: CUSTOMER_WHERE }),
  ]);
  return paginate(items, total, page, pageSize);
}

type SegmentCondition =
  | { lastOrderDaysAgo: { gt?: number; gte?: number; lt?: number; lte?: number } }
  | { totalSpent: { gt?: number; gte?: number; lt?: number; lte?: number } }
  | { orderCount: { gt?: number; gte?: number; lt?: number; lte?: number } };

function matchesRange(value: number, range: { gt?: number; gte?: number; lt?: number; lte?: number }) {
  if (range.gt != null && !(value > range.gt)) return false;
  if (range.gte != null && !(value >= range.gte)) return false;
  if (range.lt != null && !(value < range.lt)) return false;
  if (range.lte != null && !(value <= range.lte)) return false;
  return true;
}

/**
 * Server-evaluated against real Order data — segment membership is never
 * stored per-user (schema comment on CustomerSegment), so this recomputes
 * it on every call.
 */
export async function evaluateSegment(definition: unknown): Promise<string[]> {
  const condition = definition as SegmentCondition;
  const customers = await listCustomers();

  const matches: string[] = [];
  for (const customer of customers) {
    const profile = await getCustomerProfile(customer.id);

    if ("lastOrderDaysAgo" in condition) {
      const daysAgo = profile.lastOrderAt
        ? (Date.now() - profile.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      if (!matchesRange(daysAgo, condition.lastOrderDaysAgo)) continue;
    }
    if ("totalSpent" in condition) {
      if (!matchesRange(profile.lifetimeValue, condition.totalSpent)) continue;
    }
    if ("orderCount" in condition) {
      if (!matchesRange(profile.orderCount, condition.orderCount)) continue;
    }

    matches.push(customer.id);
  }
  return matches;
}

export function listSegments() {
  return prisma.customerSegment.findMany({ orderBy: { createdAt: "desc" } });
}

export function createSegment(name: string, definition: object) {
  return prisma.customerSegment.create({ data: { name, definition } });
}

export async function deleteSegment(id: string) {
  await prisma.customerSegment.delete({ where: { id } });
}
