import "server-only";
import type { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export class InventoryError extends Error {}

const RESERVATION_TYPES: InventoryMovementType[] = ["RESERVATION", "RELEASE"];

interface RecordMovementInput {
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  type: InventoryMovementType;
  /**
   * Signed delta. For PURCHASE/RETURN/ADJUSTMENT/DAMAGE/TRANSFER/SALE this
   * is applied directly to Inventory.quantity. For RESERVATION/RELEASE the
   * magnitude is applied to Inventory.reserved (RESERVATION increases it,
   * RELEASE decreases it) — the sign of `quantity` doesn't matter for
   * those two types.
   */
  quantity: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  actorId?: string;
}

/**
 * The only code path allowed to write Inventory.quantity or .reserved —
 * every change is paired with an immutable InventoryMovement row in the
 * same transaction (DATABASE.md §4 / spec §11). Takes an existing
 * transaction client so it composes with other writes (e.g. creating a
 * product and its opening stock atomically); use
 * `recordInventoryMovementStandalone` when there's no surrounding
 * transaction.
 */
export async function recordInventoryMovement(
  tx: Prisma.TransactionClient,
  input: RecordMovementInput,
) {
  // Not expressed as a single `upsert` against the @@unique compound key:
  // Postgres does not treat NULL as equal to NULL for uniqueness purposes,
  // so `variantId: null` (the common case — most products have no
  // variants) can't be used as a Prisma compound-unique lookup. A partial
  // unique index (migration 20260819010000_inventory_partial_unique_no_variant)
  // still enforces one Inventory row per product+warehouse at the database
  // level when variantId is null; this find-then-write mirrors that.
  const variantId = input.variantId ?? null;
  const existing = await tx.inventory.findFirst({
    where: { productId: input.productId, variantId, warehouseId: input.warehouseId },
  });
  const inventory =
    existing ??
    (await tx.inventory.create({
      data: {
        productId: input.productId,
        variantId,
        warehouseId: input.warehouseId,
        quantity: 0,
        reserved: 0,
      },
    }));

  if (RESERVATION_TYPES.includes(input.type)) {
    const reservedDelta =
      input.type === "RESERVATION" ? Math.abs(input.quantity) : -Math.abs(input.quantity);
    const nextReserved = inventory.reserved + reservedDelta;
    if (nextReserved < 0) {
      throw new InventoryError("Reserved quantity cannot go below zero.");
    }
    await tx.inventory.update({
      where: { id: inventory.id },
      data: { reserved: nextReserved },
    });
  } else {
    const nextQuantity = inventory.quantity + input.quantity;
    if (nextQuantity < 0) {
      throw new InventoryError("Stock quantity cannot go below zero.");
    }
    await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: nextQuantity },
    });
  }

  await tx.inventoryMovement.create({
    data: {
      inventoryId: inventory.id,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorId: input.actorId,
    },
  });

  return tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
}

export function recordInventoryMovementStandalone(input: RecordMovementInput) {
  return prisma.$transaction((tx) => recordInventoryMovement(tx, input));
}

/** Sum of sellable stock (quantity - reserved) across all warehouses. */
// DIGITAL products have no Inventory rows by design (checkout.ts skips
// physical stock reservation for them) — reported as always available so
// every stock check funneling through this one function (cart, PDP) works
// the same way for both product types without each caller re-deriving it.
const UNLIMITED_DIGITAL_STOCK = 999_999;

export async function getAvailableStock(productId: string, variantId?: string | null) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { type: true } });
  if (product?.type === "DIGITAL") return UNLIMITED_DIGITAL_STOCK;

  const rows = await prisma.inventory.findMany({
    where: { productId, variantId: variantId ?? null },
    select: { quantity: true, reserved: true },
  });
  return rows.reduce((sum, row) => sum + (row.quantity - row.reserved), 0);
}

export function listMovementsForInventory(inventoryId: string) {
  return prisma.inventoryMovement.findMany({
    where: { inventoryId },
    orderBy: { createdAt: "desc" },
  });
}
