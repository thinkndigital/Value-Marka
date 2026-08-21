import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  getSalesTrend,
  getInventoryTurnover,
  getSellerGmvLeaderboard,
  getTopProductsBySeller,
  getCouponPerformance,
  getAffiliatePerformance,
} from "@/server/services/analytics";

// Analytics are pure derivations over real LedgerEntry/OrderItem/Inventory
// rows (same rule as the Phase 6 financial reports) — this seeds real data
// at known timestamps and checks the arithmetic/bucketing/ranking against
// hand-computed expectations.

const PREFIX = "analytics-test-";

let categoryId: string;
let sellerAId: string;
let sellerBId: string;
let buyerId: string;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [userA, userB, buyer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-a-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "A",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-b-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "B",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Analytics",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const [sellerA, sellerB] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: userA.id,
        storeSlug: `${PREFIX}store-a-${Date.now()}`,
        storeName: "Analytics Store A",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: userB.id,
        storeSlug: `${PREFIX}store-b-${Date.now()}`,
        storeName: "Analytics Store B",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
});

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { subjectId: { in: [sellerAId, sellerBId] } } });
  await prisma.affiliateConversion.deleteMany({ where: { affiliate: { userId: buyerId } } });
  await prisma.affiliate.deleteMany({ where: { userId: buyerId } });
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { sellerId: { in: [sellerAId, sellerBId] } } } });
  await prisma.sellerOrder.deleteMany({ where: { sellerId: { in: [sellerAId, sellerBId] } } });
  await prisma.couponUsage.deleteMany({ where: { userId: buyerId } });
  await prisma.order.deleteMany({ where: { userId: buyerId } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: PREFIX.toUpperCase() } } });
  await prisma.inventory.deleteMany({ where: { product: { sellerId: { in: [sellerAId, sellerBId] } } } });
  await prisma.product.deleteMany({ where: { sellerId: { in: [sellerAId, sellerBId] } } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerAId, sellerBId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("getSalesTrend", () => {
  it("buckets SALE ledger entries by day and counts distinct SellerOrders", async () => {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          type: "SALE",
          amount: "100.00",
          currencyCode: "USD",
          subjectType: "SELLER",
          subjectId: sellerAId,
          referenceType: "SellerOrder",
          referenceId: "so-trend-1",
          createdAt: daysAgo(0),
        },
        {
          type: "SALE",
          amount: "50.00",
          currencyCode: "USD",
          subjectType: "SELLER",
          subjectId: sellerAId,
          referenceType: "SellerOrder",
          referenceId: "so-trend-2",
          createdAt: daysAgo(0),
        },
        {
          type: "SALE",
          amount: "30.00",
          currencyCode: "USD",
          subjectType: "SELLER",
          subjectId: sellerAId,
          referenceType: "SellerOrder",
          referenceId: "so-trend-3",
          createdAt: daysAgo(2),
        },
      ],
    });

    const trend = await getSalesTrend("USD", 7, sellerAId);
    expect(trend).toHaveLength(7);

    const today = trend[trend.length - 1];
    expect(today.grossSales).toBe(150);
    expect(today.orderCount).toBe(2);

    const twoDaysAgo = trend[trend.length - 3];
    expect(twoDaysAgo.grossSales).toBe(30);
    expect(twoDaysAgo.orderCount).toBe(1);

    const untouchedDay = trend[0];
    expect(untouchedDay.grossSales).toBe(0);
    expect(untouchedDay.orderCount).toBe(0);
  });

  it("scopes to one seller when sellerId is passed, platform-wide otherwise", async () => {
    await prisma.ledgerEntry.create({
      data: {
        type: "SALE",
        amount: "20.00",
        currencyCode: "USD",
        subjectType: "SELLER",
        subjectId: sellerBId,
        referenceType: "SellerOrder",
        referenceId: "so-trend-b",
        createdAt: daysAgo(0),
      },
    });

    const sellerATrend = await getSalesTrend("USD", 1, sellerAId);
    const sellerBTrend = await getSalesTrend("USD", 1, sellerBId);
    expect(sellerATrend[0].grossSales).toBe(150);
    expect(sellerBTrend[0].grossSales).toBe(20);
  });
});

describe("getInventoryTurnover", () => {
  it("computes cogs / current inventory value", async () => {
    const product = await prisma.product.create({
      data: {
        sellerId: sellerAId,
        categoryId,
        slug: `${PREFIX}turnover-${Date.now()}`,
        sku: "TURN-1",
        name: "Turnover Product",
        price: "40.00",
        costPrice: "10.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: { sellerId: sellerAId, name: "Turnover Warehouse", countryCode: "JO", city: "Amman" },
    });
    await prisma.inventory.create({
      data: { productId: product.id, warehouseId: warehouse.id, quantity: 20, reserved: 0 },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-turnover-${Date.now()}`,
        userId: buyerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "80.00",
        grandTotal: "80.00",
      },
    });
    const sellerOrder = await prisma.sellerOrder.create({
      data: { orderId: order.id, sellerId: sellerAId, status: "DELIVERED", subtotal: "80.00" },
    });
    await prisma.orderItem.create({
      data: {
        sellerOrderId: sellerOrder.id,
        productId: product.id,
        nameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: 2,
        unitPrice: "40.00",
        unitCostPrice: "10.00",
        lineTotal: "80.00",
      },
    });

    const turnover = await getInventoryTurnover("USD", {}, sellerAId);
    // cogs from the delivered order item: 2 * 10 = 20; inventory value: 20 * 10 = 200
    expect(turnover.cogs).toBeGreaterThanOrEqual(20);
    expect(turnover.inventoryValue).toBeGreaterThanOrEqual(200);
    expect(turnover.turnoverRatio).toBe(
      Math.round((turnover.cogs / turnover.inventoryValue) * 100) / 100,
    );
  });

  it("returns a null ratio when there's no inventory value to divide by", async () => {
    const emptySeller = await prisma.seller.create({
      data: {
        userId: (
          await prisma.user.create({
            data: {
              email: `${PREFIX}empty-seller-${Date.now()}@example.com`,
              firstName: "Empty",
              lastName: "Seller",
              passwordHash: "unused",
            },
          })
        ).id,
        storeSlug: `${PREFIX}empty-store-${Date.now()}`,
        storeName: "Empty Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    });

    const turnover = await getInventoryTurnover("USD", {}, emptySeller.id);
    expect(turnover.turnoverRatio).toBeNull();

    await prisma.seller.delete({ where: { id: emptySeller.id } });
  });
});

describe("getSellerGmvLeaderboard", () => {
  it("ranks sellers by SALE ledger total, descending", async () => {
    const leaderboard = await getSellerGmvLeaderboard("USD", {}, 10);
    const aEntry = leaderboard.find((e) => e.sellerId === sellerAId);
    const bEntry = leaderboard.find((e) => e.sellerId === sellerBId);
    // All-time sum across every SALE entry posted for this seller in the
    // suite above: 100 + 50 (today) + 30 (two days ago) = 180.
    expect(aEntry?.gmv).toBe(180);
    expect(bEntry?.gmv).toBe(20);

    const aIndex = leaderboard.findIndex((e) => e.sellerId === sellerAId);
    const bIndex = leaderboard.findIndex((e) => e.sellerId === sellerBId);
    expect(aIndex).toBeLessThan(bIndex);
  });
});

describe("getTopProductsBySeller", () => {
  it("aggregates revenue and quantity per product from delivered order items", async () => {
    const [productX, productY] = await Promise.all([
      prisma.product.create({
        data: {
          sellerId: sellerAId,
          categoryId,
          slug: `${PREFIX}top-x-${Date.now()}`,
          sku: "TOP-X",
          name: "Top Product X",
          price: "25.00",
          costPrice: "10.00",
          currencyCode: "USD",
          status: "ACTIVE",
        },
      }),
      prisma.product.create({
        data: {
          sellerId: sellerAId,
          categoryId,
          slug: `${PREFIX}top-y-${Date.now()}`,
          sku: "TOP-Y",
          name: "Top Product Y",
          price: "5.00",
          costPrice: "2.00",
          currencyCode: "USD",
          status: "ACTIVE",
        },
      }),
    ]);

    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-top-${Date.now()}`,
        userId: buyerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "60.00",
        grandTotal: "60.00",
      },
    });
    const sellerOrder = await prisma.sellerOrder.create({
      data: { orderId: order.id, sellerId: sellerAId, status: "DELIVERED", subtotal: "60.00" },
    });
    await prisma.orderItem.createMany({
      data: [
        {
          sellerOrderId: sellerOrder.id,
          productId: productX.id,
          nameSnapshot: productX.name,
          skuSnapshot: productX.sku,
          quantity: 2,
          unitPrice: "25.00",
          unitCostPrice: "10.00",
          lineTotal: "50.00",
        },
        {
          sellerOrderId: sellerOrder.id,
          productId: productY.id,
          nameSnapshot: productY.name,
          skuSnapshot: productY.sku,
          quantity: 2,
          unitPrice: "5.00",
          unitCostPrice: "2.00",
          lineTotal: "10.00",
        },
      ],
    });

    const top = await getTopProductsBySeller(sellerAId, {});
    const x = top.find((p) => p.productId === productX.id);
    const y = top.find((p) => p.productId === productY.id);
    expect(x?.revenue).toBeGreaterThanOrEqual(50);
    expect(x?.quantitySold).toBeGreaterThanOrEqual(2);
    expect(y?.revenue).toBeGreaterThanOrEqual(10);
    expect(top.indexOf(x!)).toBeLessThan(top.indexOf(y!));
  });
});

describe("getCouponPerformance", () => {
  it("only counts orders that redeemed a coupon", async () => {
    // Global aggregate (not scoped to this file's seller/buyer ids) — like
    // the platform-wide financial report in tests/finance, this asserts
    // against a delta from a captured baseline rather than an absolute
    // value, so it stays correct even if other data exists in the database.
    const baseline = await getCouponPerformance("USD", {});

    const coupon = await prisma.coupon.create({
      data: { code: `${PREFIX}PERF`.toUpperCase(), type: "FIXED_AMOUNT", value: "10", sellerId: null },
    });

    await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-coupon-${Date.now()}`,
        userId: buyerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "100.00",
        discountTotal: "10.00",
        grandTotal: "90.00",
        couponId: coupon.id,
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-no-coupon-${Date.now()}`,
        userId: buyerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "40.00",
        grandTotal: "40.00",
      },
    });

    const perf = await getCouponPerformance("USD", {});
    expect(perf.redemptions - baseline.redemptions).toBe(1);
    expect(Math.round((perf.totalDiscount - baseline.totalDiscount) * 100) / 100).toBe(10);
    expect(Math.round((perf.orderRevenue - baseline.orderRevenue) * 100) / 100).toBe(90);
  });
});

describe("getAffiliatePerformance", () => {
  it("sums commission and order revenue for PURCHASE-stage conversions", async () => {
    // Same global-aggregate caveat as getCouponPerformance above.
    const baseline = await getAffiliatePerformance("USD", {});

    const affiliate = await prisma.affiliate.create({
      data: { userId: buyerId, affiliateCode: `${PREFIX}code-${Date.now()}`, status: "APPROVED" },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-affiliate-${Date.now()}`,
        userId: buyerId,
        status: "DELIVERED",
        currencyCode: "USD",
        subtotal: "200.00",
        grandTotal: "200.00",
      },
    });
    await prisma.affiliateConversion.create({
      data: { affiliateId: affiliate.id, orderId: order.id, stage: "PURCHASE", commissionAmount: "15.00" },
    });

    const perf = await getAffiliatePerformance("USD", {});
    expect(perf.conversions - baseline.conversions).toBe(1);
    expect(Math.round((perf.commissionPaid - baseline.commissionPaid) * 100) / 100).toBe(15);
    expect(Math.round((perf.orderRevenue - baseline.orderRevenue) * 100) / 100).toBe(200);
  });
});
