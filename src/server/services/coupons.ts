import "server-only";
import { prisma } from "@/server/db";
import type { Coupon, Prisma } from "@prisma/client";

export class CouponError extends Error {}

export interface CouponApplication {
  coupon: Coupon;
  discountAmount: number;
  freeShipping: boolean;
}

/**
 * Validates a coupon code against the current cart and computes the real
 * discount — never trusts a client-declared amount (ARCHITECTURE.md §3).
 * `applicableSubtotal` is the whole cart for a platform-wide coupon
 * (`sellerId` null) or just that seller's line items for a seller-scoped
 * one, since a seller's coupon can't discount another seller's goods.
 */
export async function validateCoupon(
  code: string,
  userId: string,
  cartItems: { sellerId: string; lineTotal: number }[],
): Promise<CouponApplication> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.isActive) {
    throw new CouponError("This coupon code isn't valid.");
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new CouponError("This coupon isn't active yet.");
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    throw new CouponError("This coupon has expired.");
  }

  if (coupon.usageLimit != null) {
    const totalUses = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (totalUses >= coupon.usageLimit) {
      throw new CouponError("This coupon has reached its usage limit.");
    }
  }
  if (coupon.usageLimitPerUser != null) {
    const userUses = await prisma.couponUsage.count({ where: { couponId: coupon.id, userId } });
    if (userUses >= coupon.usageLimitPerUser) {
      throw new CouponError("You've already used this coupon the maximum number of times.");
    }
  }

  const applicableItems = coupon.sellerId
    ? cartItems.filter((item) => item.sellerId === coupon.sellerId)
    : cartItems;
  const applicableSubtotal = applicableItems.reduce((sum, item) => sum + item.lineTotal, 0);

  if (coupon.sellerId && applicableSubtotal === 0) {
    throw new CouponError("This coupon doesn't apply to any items in your cart.");
  }
  if (coupon.minOrderTotal != null && applicableSubtotal < Number(coupon.minOrderTotal)) {
    throw new CouponError(`This coupon requires a minimum order of ${coupon.minOrderTotal}.`);
  }

  if (coupon.type === "FREE_SHIPPING") {
    return { coupon, discountAmount: 0, freeShipping: true };
  }

  let discountAmount =
    coupon.type === "PERCENTAGE"
      ? applicableSubtotal * (Number(coupon.value) / 100)
      : Number(coupon.value);

  if (coupon.maxDiscount != null) {
    discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
  }
  discountAmount = Math.min(discountAmount, applicableSubtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { coupon, discountAmount, freeShipping: false };
}

export function recordCouponUsage(
  tx: Prisma.TransactionClient,
  couponId: string,
  userId: string,
  orderId: string,
) {
  return tx.couponUsage.create({ data: { couponId, userId, orderId } });
}

interface CouponInput {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  minOrderTotal?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  startsAt?: Date;
  endsAt?: Date;
}

export async function createCoupon(sellerId: string | null, input: CouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { code: input.code.trim().toUpperCase() } });
  if (existing) throw new CouponError("A coupon with this code already exists.");

  return prisma.coupon.create({
    data: { ...input, sellerId, code: input.code.trim().toUpperCase() },
  });
}

export function listCouponsForSeller(sellerId: string) {
  return prisma.coupon.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } });
}

export function listPlatformCoupons() {
  return prisma.coupon.findMany({ where: { sellerId: null }, orderBy: { createdAt: "desc" } });
}

async function getCouponScoped(sellerId: string | null, id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || coupon.sellerId !== sellerId) throw new CouponError("Coupon not found.");
  return coupon;
}

export async function deactivateCoupon(sellerId: string | null, id: string) {
  await getCouponScoped(sellerId, id);
  return prisma.coupon.update({ where: { id }, data: { isActive: false } });
}
