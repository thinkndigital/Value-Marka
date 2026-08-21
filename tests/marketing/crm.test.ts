import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getCustomerProfile, evaluateSegment, createSegment, deleteSegment } from "@/server/services/crm";

// CRM aggregates are pure derivations over real Order rows (never a cached
// column) — this seeds real orders in one currency plus a cancelled one
// that must be excluded, then checks the LTV/AOV arithmetic and a
// JSON-rule segment evaluation against them.

const PREFIX = "crm-test-";

let customerId: string;
let segmentId: string;

beforeAll(async () => {
  const customer = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "CRM",
      lastName: "Customer",
      passwordHash: "unused",
      roles: {
        create: {
          role: {
            connectOrCreate: {
              where: { key: "CUSTOMER" },
              create: { key: "CUSTOMER", name: "Customer" },
            },
          },
        },
      },
    },
  });
  customerId = customer.id;

  await prisma.order.createMany({
    data: [
      {
        orderNumber: `${PREFIX}order-1-${Date.now()}`,
        userId: customerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "100.00",
        grandTotal: "100.00",
        placedAt: new Date(Date.now() - 2 * 86400_000),
      },
      {
        orderNumber: `${PREFIX}order-2-${Date.now()}`,
        userId: customerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "50.00",
        grandTotal: "50.00",
        placedAt: new Date(),
      },
      {
        orderNumber: `${PREFIX}order-cancelled-${Date.now()}`,
        userId: customerId,
        status: "CANCELLED",
        currencyCode: "USD",
        subtotal: "999.00",
        grandTotal: "999.00",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { userId: customerId } });
  if (segmentId) await prisma.customerSegment.deleteMany({ where: { id: segmentId } });
  await prisma.user.deleteMany({ where: { id: customerId } });
  await prisma.$disconnect();
});

describe("getCustomerProfile", () => {
  it("computes orderCount/LTV/AOV from real orders, excluding cancelled ones", async () => {
    const profile = await getCustomerProfile(customerId);
    expect(profile.orderCount).toBe(2);
    expect(profile.lifetimeValue).toBe(150);
    expect(profile.averageOrderValue).toBe(75);
    expect(profile.currencyCode).toBe("USD");
  });

  it("returns zeroed defaults for a customer with no orders", async () => {
    const noOrdersUser = await prisma.user.create({
      data: {
        email: `${PREFIX}no-orders-${Date.now()}@example.com`,
        firstName: "No",
        lastName: "Orders",
        passwordHash: "unused",
      },
    });

    const profile = await getCustomerProfile(noOrdersUser.id);
    expect(profile.orderCount).toBe(0);
    expect(profile.lifetimeValue).toBe(0);
    expect(profile.lastOrderAt).toBeNull();

    await prisma.user.delete({ where: { id: noOrdersUser.id } });
  });
});

describe("evaluateSegment", () => {
  it("matches customers against a totalSpent rule computed from real orders", async () => {
    const segment = await createSegment(`${PREFIX}big-spenders`, { totalSpent: { gte: 150 } });
    segmentId = segment.id;

    const matches = await evaluateSegment(segment.definition);
    expect(matches).toContain(customerId);

    const tooHigh = await evaluateSegment({ totalSpent: { gt: 150 } });
    expect(tooHigh).not.toContain(customerId);
  });

  it("matches customers against an orderCount rule", async () => {
    const matches = await evaluateSegment({ orderCount: { gte: 2 } });
    expect(matches).toContain(customerId);

    const tooMany = await evaluateSegment({ orderCount: { gt: 2 } });
    expect(tooMany).not.toContain(customerId);
  });

  it("deletes a segment", async () => {
    const segment = await createSegment(`${PREFIX}temp`, { orderCount: { gte: 1 } });
    await deleteSegment(segment.id);
    const found = await prisma.customerSegment.findUnique({ where: { id: segment.id } });
    expect(found).toBeNull();
  });
});
