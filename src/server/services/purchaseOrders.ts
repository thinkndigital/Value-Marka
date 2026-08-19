import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { assertSellerOwns } from "@/server/rbac";
import { recordInventoryMovement } from "./inventory";

export class PurchaseOrderError extends Error {}

export function listPurchaseOrdersForSeller(sellerId: string) {
  return prisma.purchaseOrder.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { companyName: true } }, items: true },
  });
}

export async function getPurchaseOrderForSeller(sellerId: string, id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { product: { select: { name: true, sku: true } } } },
    },
  });
  if (!po) throw new PurchaseOrderError("Purchase order not found.");
  assertSellerOwns(po.sellerId, sellerId);
  return po;
}

interface PurchaseOrderLineInput {
  productId: string;
  quantityOrdered: number;
  unitCost: number;
}

interface CreatePurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  currencyCode: string;
  expectedAt?: Date;
  tax?: number;
  shipping?: number;
  items: PurchaseOrderLineInput[];
}

export async function createPurchaseOrder(sellerId: string, input: CreatePurchaseOrderInput) {
  if (input.items.length === 0) {
    throw new PurchaseOrderError("Add at least one line item.");
  }

  const [supplier, warehouse] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: input.supplierId } }),
    prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
  ]);
  if (!supplier || supplier.sellerId !== sellerId) {
    throw new PurchaseOrderError("Select a valid supplier.");
  }
  if (!warehouse || warehouse.sellerId !== sellerId) {
    throw new PurchaseOrderError("Select a valid warehouse.");
  }

  const subtotal = input.items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0);
  const tax = input.tax ?? 0;
  const shipping = input.shipping ?? 0;
  const total = subtotal + tax + shipping;

  return prisma.purchaseOrder.create({
    data: {
      sellerId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      status: "DRAFT",
      expectedAt: input.expectedAt,
      subtotal,
      tax,
      shipping,
      total,
      currencyCode: input.currencyCode,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
        })),
      },
    },
    include: { items: true },
  });
}

export async function submitPurchaseOrder(sellerId: string, id: string) {
  const po = await getPurchaseOrderForSeller(sellerId, id);
  if (po.status !== "DRAFT") {
    throw new PurchaseOrderError("Only a draft purchase order can be submitted.");
  }
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "SUBMITTED" } });
}

export async function cancelPurchaseOrder(sellerId: string, id: string) {
  const po = await getPurchaseOrderForSeller(sellerId, id);
  if (!["DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new PurchaseOrderError("This purchase order can no longer be cancelled.");
  }
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
}

interface ReceiveLineInput {
  itemId: string;
  quantityReceived: number;
}

/** Receiving a PO line creates a PURCHASE InventoryMovement for the received quantity, not the ordered quantity (DATABASE.md §4). */
export async function receivePurchaseOrderItems(
  sellerId: string,
  id: string,
  receipts: ReceiveLineInput[],
  actorId: string,
) {
  const po = await getPurchaseOrderForSeller(sellerId, id);
  if (!["SUBMITTED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new PurchaseOrderError("Submit this purchase order before receiving stock against it.");
  }

  const itemsById = new Map(po.items.map((item) => [item.id, item]));
  for (const receipt of receipts) {
    const item = itemsById.get(receipt.itemId);
    if (!item) throw new PurchaseOrderError("That line item doesn't belong to this purchase order.");
    if (receipt.quantityReceived <= 0) continue;
    const remaining = item.quantityOrdered - item.quantityReceived;
    if (receipt.quantityReceived > remaining) {
      throw new PurchaseOrderError(
        `Can't receive ${receipt.quantityReceived} of "${item.product.name}" — only ${remaining} remain on order.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const receipt of receipts) {
      if (receipt.quantityReceived <= 0) continue;
      const item = itemsById.get(receipt.itemId)!;

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: { increment: receipt.quantityReceived } },
      });

      await recordInventoryMovement(tx, {
        productId: item.productId,
        warehouseId: po.warehouseId,
        type: "PURCHASE",
        quantity: receipt.quantityReceived,
        reason: `Received against PO ${po.id}`,
        referenceType: "PurchaseOrder",
        referenceId: po.id,
        actorId,
      });
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
    const fullyReceived = refreshedItems.every((item) => item.quantityReceived >= item.quantityOrdered);
    await tx.purchaseOrder.update({
      where: { id },
      data: { status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
    });
  });

  return getPurchaseOrderForSeller(sellerId, id);
}

/**
 * Manual settlement record, not a real payment call — paying a supplier
 * happens outside the platform (bank transfer, cash). Posts a PURCHASE
 * ledger entry (the seller's cash outflow to acquire this inventory) so
 * COGS/profit reporting reflects it.
 */
export async function markPurchaseOrderPaid(sellerId: string, id: string) {
  const po = await getPurchaseOrderForSeller(sellerId, id);
  if (po.paymentStatus === "PAID") throw new PurchaseOrderError("This purchase order is already paid.");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.purchaseOrder.update({ where: { id }, data: { paymentStatus: "PAID" } });
    await tx.ledgerEntry.create({
      data: {
        type: "PURCHASE",
        amount: -Number(po.total),
        currencyCode: po.currencyCode,
        subjectType: "SELLER",
        subjectId: sellerId,
        referenceType: "PurchaseOrder",
        referenceId: po.id,
        description: `Purchase order paid — ${po.supplier.companyName}`,
      },
    });
  });
}
