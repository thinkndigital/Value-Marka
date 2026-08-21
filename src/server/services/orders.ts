import "server-only";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { recordInventoryMovement } from "./inventory";
import { assertSellerOwns } from "@/server/rbac";
import { sendEmailNotification } from "@/server/notifications/send";
import { shipmentEmail, refundEmail } from "@/server/notifications/templates";

export class OrderError extends Error {}

const RETURN_WINDOW_DAYS = 14;

/**
 * Forward progression a seller drives themselves, plus the branches a
 * customer or seller action can take from specific points. DELIVERED only
 * ever moves via a customer-initiated return request (see requestReturn),
 * never as a seller "next step" — that's why it has no seller-facing entry
 * in SELLER_TRANSITIONS below.
 */
const SELLER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"], // approve or reject
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
};

// Used to compute the parent Order's aggregate status — see
// recomputeOrderStatus below.
const PROGRESSION: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/**
 * The parent Order has no lifecycle of its own — spec/DATABASE.md §5 puts
 * fulfillment state on SellerOrder, scoped per seller. Order.status is a
 * derived summary for the customer: CANCELLED only once every seller's
 * portion is cancelled, RETURN_REQUESTED as soon as any portion is, and
 * otherwise the least-advanced live (non-cancelled) SellerOrder — the
 * customer's order isn't "shipped" until every seller has shipped their
 * part.
 */
function aggregateOrderStatus(sellerStatuses: OrderStatus[]): OrderStatus {
  if (sellerStatuses.every((s) => s === "CANCELLED")) return "CANCELLED";
  if (sellerStatuses.some((s) => s === "RETURN_REQUESTED")) return "RETURN_REQUESTED";

  const live = sellerStatuses.filter((s) => s !== "CANCELLED");
  if (live.length > 0 && live.every((s) => s === "RETURNED" || s === "REFUNDED")) {
    return live.every((s) => s === "REFUNDED") ? "REFUNDED" : "RETURNED";
  }

  const progressionStatuses = live.filter((s) => PROGRESSION.includes(s));
  if (progressionStatuses.length > 0) {
    const minIndex = Math.min(...progressionStatuses.map((s) => PROGRESSION.indexOf(s)));
    return PROGRESSION[minIndex];
  }

  return live[0] ?? "CANCELLED";
}

async function recomputeOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
  const sellerOrders = await tx.sellerOrder.findMany({
    where: { orderId },
    select: { status: true },
  });
  const status = aggregateOrderStatus(sellerOrders.map((s) => s.status));
  await tx.order.update({ where: { id: orderId }, data: { status } });
}

/** Per-warehouse breakdown of the RESERVATION movements checkout made for this order line. */
async function getReservationBreakdown(
  tx: Prisma.TransactionClient,
  orderId: string,
  productId: string,
  variantId: string | null,
) {
  const movements = await tx.inventoryMovement.findMany({
    where: {
      referenceType: "Order",
      referenceId: orderId,
      type: "RESERVATION",
      inventory: { productId, variantId },
    },
    select: { quantity: true, inventory: { select: { warehouseId: true } } },
  });
  return movements.map((m) => ({ warehouseId: m.inventory.warehouseId, quantity: m.quantity }));
}

async function releaseReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: { productId: string; variantId: string | null }[],
  actorId?: string,
) {
  for (const item of items) {
    const breakdown = await getReservationBreakdown(tx, orderId, item.productId, item.variantId);
    for (const { warehouseId, quantity } of breakdown) {
      await recordInventoryMovement(tx, {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId,
        type: "RELEASE",
        quantity,
        reason: "Order cancelled",
        referenceType: "Order",
        referenceId: orderId,
        actorId,
      });
    }
  }
}

async function convertReservationsToSale(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: { productId: string; variantId: string | null }[],
  actorId?: string,
) {
  for (const item of items) {
    const breakdown = await getReservationBreakdown(tx, orderId, item.productId, item.variantId);
    for (const { warehouseId, quantity } of breakdown) {
      await recordInventoryMovement(tx, {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId,
        type: "RELEASE",
        quantity,
        reason: "Order delivered",
        referenceType: "Order",
        referenceId: orderId,
        actorId,
      });
      await recordInventoryMovement(tx, {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId,
        type: "SALE",
        quantity: -quantity,
        reason: "Order delivered",
        referenceType: "Order",
        referenceId: orderId,
        actorId,
      });
    }
  }
}

async function restockReturn(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: { productId: string; variantId: string | null }[],
  actorId?: string,
) {
  for (const item of items) {
    // Return the stock to the same warehouse(s) it was originally sold
    // from, in the same proportions.
    const breakdown = await getReservationBreakdown(tx, orderId, item.productId, item.variantId);
    for (const { warehouseId, quantity } of breakdown) {
      await recordInventoryMovement(tx, {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId,
        type: "RETURN",
        quantity,
        reason: "Order returned",
        referenceType: "Order",
        referenceId: orderId,
        actorId,
      });
    }
  }
}

export function listSellerOrders(sellerId: string, status?: OrderStatus) {
  return prisma.sellerOrder.findMany({
    where: { sellerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      order: { select: { orderNumber: true, currencyCode: true, placedAt: true } },
    },
  });
}

export async function getSellerOrderForSeller(sellerId: string, id: string) {
  const sellerOrder = await prisma.sellerOrder.findUnique({
    where: { id },
    include: {
      items: true,
      shipments: true,
      refunds: true,
      order: {
        select: { orderNumber: true, currencyCode: true, placedAt: true, address: true },
      },
    },
  });
  if (!sellerOrder) throw new OrderError("Order not found.");
  assertSellerOwns(sellerOrder.sellerId, sellerId);
  return sellerOrder;
}

interface TransitionOptions {
  actorId?: string;
  carrier?: string;
  trackingNumber?: string;
}

export async function transitionSellerOrder(
  sellerId: string,
  sellerOrderId: string,
  nextStatus: OrderStatus,
  options: TransitionOptions = {},
) {
  const sellerOrder = await prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      items: true,
      seller: { select: { storeName: true } },
      order: { select: { orderNumber: true, currencyCode: true, user: { select: { id: true, email: true } } } },
    },
  });
  if (!sellerOrder) throw new OrderError("Order not found.");
  assertSellerOwns(sellerOrder.sellerId, sellerId);

  const allowed = SELLER_TRANSITIONS[sellerOrder.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new OrderError(`Cannot move an order from ${sellerOrder.status} to ${nextStatus}.`);
  }

  const items = sellerOrder.items.map((i) => ({ productId: i.productId, variantId: i.variantId }));

  await prisma.$transaction(async (tx) => {
    if (nextStatus === "CANCELLED") {
      await releaseReservations(tx, sellerOrder.orderId, items, options.actorId);
    }

    if (nextStatus === "SHIPPED") {
      if (!options.carrier || !options.trackingNumber) {
        throw new OrderError("Carrier and tracking number are required to ship an order.");
      }
      await tx.shipment.create({
        data: {
          sellerOrderId,
          carrier: options.carrier,
          trackingNumber: options.trackingNumber,
          status: "SHIPPED",
          shippedAt: new Date(),
        },
      });
    }

    if (nextStatus === "OUT_FOR_DELIVERY") {
      await tx.shipment.updateMany({
        where: { sellerOrderId },
        data: { status: "OUT_FOR_DELIVERY" },
      });
    }

    if (nextStatus === "DELIVERED") {
      await convertReservationsToSale(tx, sellerOrder.orderId, items, options.actorId);
      await tx.shipment.updateMany({
        where: { sellerOrderId },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    }

    if (nextStatus === "RETURNED") {
      await restockReturn(tx, sellerOrder.orderId, items, options.actorId);
      const existingRefund = await tx.refund.findFirst({ where: { sellerOrderId } });
      if (existingRefund) {
        await tx.refund.update({ where: { id: existingRefund.id }, data: { status: "APPROVED" } });
      } else {
        await tx.refund.create({
          data: { sellerOrderId, amount: sellerOrder.subtotal, status: "APPROVED" },
        });
      }
    }

    if (nextStatus === "REFUNDED") {
      await tx.refund.updateMany({ where: { sellerOrderId }, data: { status: "COMPLETED" } });
    }

    await tx.sellerOrder.update({ where: { id: sellerOrderId }, data: { status: nextStatus } });
    await recomputeOrderStatus(tx, sellerOrder.orderId);
  });

  if (sellerOrder.order.user) {
    if (nextStatus === "SHIPPED" && options.carrier && options.trackingNumber) {
      const email = shipmentEmail({
        orderNumber: sellerOrder.order.orderNumber,
        storeName: sellerOrder.seller.storeName,
        carrier: options.carrier,
        trackingNumber: options.trackingNumber,
      });
      sendEmailNotification({
        userId: sellerOrder.order.user.id,
        to: sellerOrder.order.user.email,
        type: "shipment",
        subject: email.subject,
        html: email.html,
      });
    }

    if (nextStatus === "RETURNED") {
      const email = refundEmail({
        orderNumber: sellerOrder.order.orderNumber,
        storeName: sellerOrder.seller.storeName,
        amount: sellerOrder.subtotal.toString(),
        currencyCode: sellerOrder.order.currencyCode,
      });
      sendEmailNotification({
        userId: sellerOrder.order.user.id,
        to: sellerOrder.order.user.email,
        type: "refund",
        subject: email.subject,
        html: email.html,
      });
    }
  }

  return getSellerOrderForSeller(sellerId, sellerOrderId);
}

/**
 * Customer-initiated cancellation. Multi-vendor orders can be partially
 * cancelled: a seller who has already moved their portion past PACKED
 * can't be cancelled out from under them, but sellers who haven't started
 * fulfillment yet can be — this returns how many of the customer's
 * SellerOrders were actually cancelled.
 */
export async function requestCustomerCancellation(userId: string, orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { sellerOrders: { include: { items: true } } },
  });
  if (!order || order.userId !== userId) throw new OrderError("Order not found.");

  const cancellable = order.sellerOrders.filter((so) => SELLER_TRANSITIONS[so.status]?.includes("CANCELLED"));
  if (cancellable.length === 0) {
    throw new OrderError("This order can no longer be cancelled — it's already being fulfilled.");
  }

  await prisma.$transaction(async (tx) => {
    for (const sellerOrder of cancellable) {
      const items = sellerOrder.items.map((i) => ({ productId: i.productId, variantId: i.variantId }));
      await releaseReservations(tx, order.id, items, userId);
      await tx.sellerOrder.update({ where: { id: sellerOrder.id }, data: { status: "CANCELLED" } });
    }
    await recomputeOrderStatus(tx, order.id);
  });

  return { cancelledCount: cancellable.length, totalCount: order.sellerOrders.length };
}

export async function requestReturn(userId: string, orderNumber: string, sellerOrderId: string, reason: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { sellerOrders: { include: { shipments: true } } },
  });
  if (!order || order.userId !== userId) throw new OrderError("Order not found.");

  const sellerOrder = order.sellerOrders.find((so) => so.id === sellerOrderId);
  if (!sellerOrder) throw new OrderError("Order not found.");
  if (sellerOrder.status !== "DELIVERED") {
    throw new OrderError("Only delivered items can be returned.");
  }

  const deliveredAt = sellerOrder.shipments.find((s) => s.deliveredAt)?.deliveredAt;
  if (deliveredAt) {
    const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > RETURN_WINDOW_DAYS) {
      throw new OrderError(`Returns are only accepted within ${RETURN_WINDOW_DAYS} days of delivery.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: { sellerOrderId, amount: sellerOrder.subtotal, reason, status: "PENDING" },
    });
    await tx.sellerOrder.update({ where: { id: sellerOrderId }, data: { status: "RETURN_REQUESTED" } });
    await recomputeOrderStatus(tx, order.id);
  });
}

/**
 * System-triggered (not a seller action): called from
 * src/server/services/payments.ts once a payment actually captures. No
 * `assertSellerOwns` check here — there is no calling seller, only the
 * payment provider's own confirmation that money moved. Every SellerOrder
 * that's still PENDING (i.e. hasn't already been cancelled) moves straight
 * to CONFIRMED, since a captured payment is exactly what tells a seller
 * they can start fulfilling (DATABASE.md §6/§7).
 */
export async function confirmSellerOrdersOnPayment(tx: Prisma.TransactionClient, orderId: string) {
  const pending = await tx.sellerOrder.findMany({ where: { orderId, status: "PENDING" } });
  for (const sellerOrder of pending) {
    await tx.sellerOrder.update({ where: { id: sellerOrder.id }, data: { status: "CONFIRMED" } });
  }
  await recomputeOrderStatus(tx, orderId);
}
