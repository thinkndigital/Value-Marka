import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { recordInventoryMovement } from "./inventory";
import { validateCoupon, recordCouponUsage, CouponError } from "./coupons";
import { recordAffiliateConversion, type AffiliateAttribution } from "./affiliates";
import { rewardReferralOnFirstOrder } from "./referrals";
import { sendEmailNotification } from "@/server/notifications/send";
import { orderConfirmationEmail } from "@/server/notifications/templates";
import {
  getActiveFlashSaleItemsForProducts,
  resolveEffectivePrice,
  claimFlashSaleStock,
  FlashSaleError,
} from "./flashSales";
import { getBundleComponentQuantities } from "./bundles";

export class CheckoutError extends Error {}

function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `VM-${stamp}-${random}`;
}

async function reserveStockForItem(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    variantId: string | null;
    quantity: number;
    orderId: string;
    actorId?: string;
  },
) {
  const inventoryRows = await tx.inventory.findMany({
    where: { productId: input.productId, variantId: input.variantId },
    orderBy: { quantity: "desc" },
  });

  let remaining = input.quantity;
  for (const row of inventoryRows) {
    if (remaining <= 0) break;
    const available = row.quantity - row.reserved;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    await recordInventoryMovement(tx, {
      productId: input.productId,
      variantId: input.variantId,
      warehouseId: row.warehouseId,
      type: "RESERVATION",
      quantity: take,
      reason: "Stock reserved at checkout",
      referenceType: "Order",
      referenceId: input.orderId,
      actorId: input.actorId,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new CheckoutError("Stock changed before your order could be placed. Please review your cart.");
  }
}

export interface PlaceOrderOptions {
  couponCode?: string;
  affiliateAttribution?: AffiliateAttribution;
}

export async function placeOrder(userId: string, addressId: string, options: PlaceOrderOptions = {}) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new CheckoutError("Select a valid shipping address.");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true, variant: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }

  for (const item of cart.items) {
    if (item.product.status !== "ACTIVE") {
      throw new CheckoutError(`${item.product.name} is no longer available.`);
    }
  }

  const taxRules = await prisma.taxRule.findMany({
    where: { countryCode: address.countryCode, isActive: true, appliesTo: { in: ["ALL", "PRODUCT"] } },
  });
  const taxRate = taxRules.reduce((sum, rule) => sum + Number(rule.rate), 0);

  // Flash-sale pricing is resolved once here, from the database, and reused
  // for the subtotal, coupon evaluation, and every OrderItem below — never
  // trust a frontend-displayed sale price or countdown.
  const cartItems = cart.items;
  const flashSaleItems = await getActiveFlashSaleItemsForProducts(
    cartItems.map((item) => item.productId),
  );
  function effectivePrice(item: (typeof cartItems)[number]): number {
    return resolveEffectivePrice(Number(item.product.price), flashSaleItems.get(item.productId));
  }

  const subtotal = cart.items.reduce((sum, item) => sum + effectivePrice(item) * item.quantity, 0);
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;

  // Platform-wide shipping methods only (sellerId null) — a seller-specific
  // rate would break the proportional shippingShare split below
  // (DATABASE.md §5), so those are left for Phase 4's fulfillment work.
  const shippingMethods = await prisma.shippingMethod.findMany({
    where: { sellerId: null, isActive: true, zone: { countryCode: address.countryCode } },
    orderBy: { price: "asc" },
  });
  const cheapestMethod = shippingMethods[0];
  let shippingTotal = cheapestMethod
    ? cheapestMethod.freeThreshold && subtotal >= Number(cheapestMethod.freeThreshold)
      ? 0
      : Number(cheapestMethod.price)
    : 0;

  let coupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (options.couponCode) {
    try {
      coupon = await validateCoupon(
        options.couponCode,
        userId,
        cart.items.map((item) => ({
          sellerId: item.product.sellerId,
          lineTotal: effectivePrice(item) * item.quantity,
        })),
      );
    } catch (err) {
      if (err instanceof CouponError) throw new CheckoutError(err.message);
      throw err;
    }
    if (coupon.freeShipping) shippingTotal = 0;
  }
  const discountTotal = coupon?.discountAmount ?? 0;

  const grandTotal = Math.round((subtotal - discountTotal + taxTotal + shippingTotal) * 100) / 100;
  const currencyCode = cart.currencyCode;

  const bySeller = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const list = bySeller.get(item.product.sellerId) ?? [];
    list.push(item);
    bySeller.set(item.product.sellerId, list);
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        addressId,
        status: "PENDING",
        currencyCode,
        subtotal,
        discountTotal,
        taxTotal,
        shippingTotal,
        grandTotal,
        couponId: coupon?.coupon.id,
      },
    });

    if (coupon) {
      await recordCouponUsage(tx, coupon.coupon.id, userId, created.id);
    }

    for (const [sellerId, items] of bySeller) {
      const sellerSubtotal = items.reduce(
        (sum, item) => sum + effectivePrice(item) * item.quantity,
        0,
      );
      const sellerTaxShare =
        subtotal > 0 ? Math.round((taxTotal * (sellerSubtotal / subtotal)) * 100) / 100 : 0;
      // A seller-scoped coupon's discount lands entirely on that seller;
      // a platform-wide one is split proportionally, same as tax.
      const sellerDiscountShare = !coupon
        ? 0
        : coupon.coupon.sellerId
          ? coupon.coupon.sellerId === sellerId
            ? discountTotal
            : 0
          : subtotal > 0
            ? Math.round((discountTotal * (sellerSubtotal / subtotal)) * 100) / 100
            : 0;

      const sellerOrder = await tx.sellerOrder.create({
        data: {
          orderId: created.id,
          sellerId,
          status: "PENDING",
          subtotal: sellerSubtotal,
          taxShare: sellerTaxShare,
          discountShare: sellerDiscountShare,
        },
      });

      for (const item of items) {
        const unitPrice = effectivePrice(item);
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        await tx.orderItem.create({
          data: {
            sellerOrderId: sellerOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            nameSnapshot: item.product.name,
            skuSnapshot: item.variant?.sku ?? item.product.sku,
            quantity: item.quantity,
            unitPrice,
            unitCostPrice: item.variant?.costPrice ?? item.product.costPrice,
            lineTotal,
          },
        });

        const flash = flashSaleItems.get(item.productId);
        if (flash) {
          try {
            await claimFlashSaleStock(tx, flash.id, item.quantity);
          } catch (err) {
            if (err instanceof FlashSaleError) throw new CheckoutError(err.message);
            throw err;
          }
        }

        // DIGITAL products have no physical stock to reserve — reserving
        // against Inventory would make every digital product permanently
        // unsellable (no Inventory row ever exists for one).
        if (item.product.type === "BUNDLE") {
          // A bundle's own Inventory never exists — reserve each
          // component's real stock instead, scaled by how many bundle
          // units were bought. The OrderItem itself still records one line
          // for the bundle (name/price snapshot above); only the
          // inventory movements happen against the components.
          const components = await getBundleComponentQuantities(item.productId);
          for (const component of components) {
            await reserveStockForItem(tx, {
              productId: component.componentProductId,
              variantId: null,
              quantity: component.quantity * item.quantity,
              orderId: created.id,
              actorId: userId,
            });
          }
        } else if (item.product.type !== "DIGITAL") {
          await reserveStockForItem(tx, {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            orderId: created.id,
            actorId: userId,
          });
        }
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  if (options.affiliateAttribution) {
    await recordAffiliateConversion(options.affiliateAttribution, order.id, subtotal, currencyCode);
  }

  const priorOrderCount = await prisma.order.count({ where: { userId, id: { not: order.id } } });
  if (priorOrderCount === 0) {
    await rewardReferralOnFirstOrder(userId);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const confirmation = orderConfirmationEmail({
    orderNumber: order.orderNumber,
    items: cart.items.map((item) => ({ name: item.product.name, quantity: item.quantity })),
    grandTotal: order.grandTotal.toString(),
    currencyCode: order.currencyCode,
  });
  sendEmailNotification({
    userId,
    to: user.email,
    type: "order_confirmation",
    subject: confirmation.subject,
    html: confirmation.html,
  });

  return order;
}

export function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    include: {
      sellerOrders: {
        include: {
          seller: { select: { storeName: true } },
          items: true,
        },
      },
    },
  });
}

export async function getOrderForUser(userId: string, orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      address: true,
      sellerOrders: {
        include: {
          seller: { select: { storeName: true } },
          items: { include: { product: { select: { type: true } } } },
        },
      },
    },
  });
  if (!order || order.userId !== userId) {
    throw new CheckoutError("Order not found.");
  }
  return order;
}
