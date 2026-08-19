import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { recordInventoryMovement } from "./inventory";

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

export async function placeOrder(userId: string, addressId: string) {
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

  const subtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;

  // Platform-wide shipping methods only (sellerId null) — a seller-specific
  // rate would break the proportional shippingShare split below
  // (DATABASE.md §5), so those are left for Phase 4's fulfillment work.
  const shippingMethods = await prisma.shippingMethod.findMany({
    where: { sellerId: null, isActive: true, zone: { countryCode: address.countryCode } },
    orderBy: { price: "asc" },
  });
  const cheapestMethod = shippingMethods[0];
  const shippingTotal = cheapestMethod
    ? cheapestMethod.freeThreshold && subtotal >= Number(cheapestMethod.freeThreshold)
      ? 0
      : Number(cheapestMethod.price)
    : 0;

  const grandTotal = Math.round((subtotal + taxTotal + shippingTotal) * 100) / 100;
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
        taxTotal,
        shippingTotal,
        grandTotal,
      },
    });

    for (const [sellerId, items] of bySeller) {
      const sellerSubtotal = items.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );
      const sellerTaxShare =
        subtotal > 0 ? Math.round((taxTotal * (sellerSubtotal / subtotal)) * 100) / 100 : 0;

      const sellerOrder = await tx.sellerOrder.create({
        data: {
          orderId: created.id,
          sellerId,
          status: "PENDING",
          subtotal: sellerSubtotal,
          taxShare: sellerTaxShare,
        },
      });

      for (const item of items) {
        const lineTotal = Math.round(Number(item.product.price) * item.quantity * 100) / 100;
        await tx.orderItem.create({
          data: {
            sellerOrderId: sellerOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            nameSnapshot: item.product.name,
            skuSnapshot: item.variant?.sku ?? item.product.sku,
            quantity: item.quantity,
            unitPrice: item.product.price,
            unitCostPrice: item.variant?.costPrice ?? item.product.costPrice,
            lineTotal,
          },
        });

        await reserveStockForItem(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          orderId: created.id,
          actorId: userId,
        });
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
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
          items: true,
        },
      },
    },
  });
  if (!order || order.userId !== userId) {
    throw new CheckoutError("Order not found.");
  }
  return order;
}
