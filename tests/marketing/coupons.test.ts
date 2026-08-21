import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { validateCoupon, recordCouponUsage, CouponError } from "@/server/services/coupons";

// Coupon discounts are computed server-side from real Coupon rows — never
// trusted from the client (ARCHITECTURE.md §3) — so this exercises the
// validation/discount arithmetic against a real database.

const PREFIX = "coupon-test-";

let buyerId: string;
let sellerId: string;
let otherSellerId: string;

beforeAll(async () => {
  const [buyer, sellerUser, otherSellerUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Coupon",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "Coupon",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}other-seller-${Date.now()}@example.com`,
        firstName: "Other",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const [seller, otherSeller] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: sellerUser.id,
        storeSlug: `${PREFIX}store-${Date.now()}`,
        storeName: "Coupon Test Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: otherSellerUser.id,
        storeSlug: `${PREFIX}other-store-${Date.now()}`,
        storeName: "Other Test Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerId = seller.id;
  otherSellerId = otherSeller.id;
});

afterAll(async () => {
  await prisma.couponUsage.deleteMany({ where: { userId: buyerId } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: PREFIX.toUpperCase() } } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("validateCoupon", () => {
  it("rejects an unknown code", async () => {
    await expect(validateCoupon("NOPE-DOES-NOT-EXIST", buyerId, [])).rejects.toBeInstanceOf(
      CouponError,
    );
  });

  it("computes a percentage discount capped by maxDiscount", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}PCT`.toUpperCase(),
        type: "PERCENTAGE",
        value: "50",
        maxDiscount: "10.00",
        sellerId: null,
      },
    });

    const result = await validateCoupon(coupon.code, buyerId, [
      { sellerId, lineTotal: 100 },
    ]);
    // 50% of 100 = 50, capped at maxDiscount = 10
    expect(result.discountAmount).toBe(10);
    expect(result.freeShipping).toBe(false);
  });

  it("computes a fixed discount, never exceeding the applicable subtotal", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}FIXED-BIG`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "999.00",
        sellerId: null,
      },
    });

    const result = await validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 30 }]);
    expect(result.discountAmount).toBe(30);
  });

  it("zeroes shipping instead of discounting the subtotal for FREE_SHIPPING coupons", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}SHIP`.toUpperCase(),
        type: "FREE_SHIPPING",
        value: "0",
        sellerId: null,
      },
    });

    const result = await validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 40 }]);
    expect(result.discountAmount).toBe(0);
    expect(result.freeShipping).toBe(true);
  });

  it("only discounts the scoped seller's share of a multi-seller cart", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}SCOPED`.toUpperCase(),
        type: "PERCENTAGE",
        value: "10",
        sellerId,
      },
    });

    const result = await validateCoupon(coupon.code, buyerId, [
      { sellerId, lineTotal: 100 },
      { sellerId: otherSellerId, lineTotal: 200 },
    ]);
    // 10% of only this seller's 100, not the other seller's 200
    expect(result.discountAmount).toBe(10);
  });

  it("rejects a seller-scoped coupon when the cart has none of that seller's items", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}SCOPED-MISS`.toUpperCase(),
        type: "PERCENTAGE",
        value: "10",
        sellerId,
      },
    });

    await expect(
      validateCoupon(coupon.code, buyerId, [{ sellerId: otherSellerId, lineTotal: 200 }]),
    ).rejects.toBeInstanceOf(CouponError);
  });

  it("enforces minOrderTotal", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}MIN`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "5",
        minOrderTotal: "50.00",
        sellerId: null,
      },
    });

    await expect(
      validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 20 }]),
    ).rejects.toBeInstanceOf(CouponError);

    const result = await validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 60 }]);
    expect(result.discountAmount).toBe(5);
  });

  it("rejects an inactive coupon", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}INACTIVE`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "5",
        isActive: false,
        sellerId: null,
      },
    });

    await expect(
      validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 20 }]),
    ).rejects.toBeInstanceOf(CouponError);
  });

  it("rejects a coupon outside its startsAt/endsAt window", async () => {
    const future = await prisma.coupon.create({
      data: {
        code: `${PREFIX}FUTURE`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "5",
        startsAt: new Date(Date.now() + 86400_000),
        sellerId: null,
      },
    });
    await expect(
      validateCoupon(future.code, buyerId, [{ sellerId, lineTotal: 20 }]),
    ).rejects.toBeInstanceOf(CouponError);

    const expired = await prisma.coupon.create({
      data: {
        code: `${PREFIX}EXPIRED`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "5",
        endsAt: new Date(Date.now() - 86400_000),
        sellerId: null,
      },
    });
    await expect(
      validateCoupon(expired.code, buyerId, [{ sellerId, lineTotal: 20 }]),
    ).rejects.toBeInstanceOf(CouponError);
  });

  it("enforces usageLimit and usageLimitPerUser against real CouponUsage rows", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}LIMIT`.toUpperCase(),
        type: "FIXED_AMOUNT",
        value: "5",
        usageLimit: 1,
        usageLimitPerUser: 1,
        sellerId: null,
      },
    });

    // Still valid before any usage.
    await validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 20 }]);

    const order = await prisma.order.create({
      data: {
        orderNumber: `${PREFIX}order-${Date.now()}`,
        userId: buyerId,
        status: "PENDING",
        currencyCode: "USD",
        subtotal: "20.00",
        grandTotal: "15.00",
      },
    });
    await prisma.$transaction((tx) => recordCouponUsage(tx, coupon.id, buyerId, order.id));

    await expect(
      validateCoupon(coupon.code, buyerId, [{ sellerId, lineTotal: 20 }]),
    ).rejects.toBeInstanceOf(CouponError);

    await prisma.couponUsage.deleteMany({ where: { couponId: coupon.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });
});
