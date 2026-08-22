import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export class FlashSaleError extends Error {}

export interface FlashSaleInput {
  name: string;
  startsAt: Date;
  endsAt: Date;
}

const itemInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, slug: true, price: true, currencyCode: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export function listFlashSales() {
  return prisma.flashSale.findMany({
    include: itemInclude,
    orderBy: { startsAt: "desc" },
  });
}

export async function getFlashSale(id: string) {
  const sale = await prisma.flashSale.findUnique({ where: { id }, include: itemInclude });
  if (!sale) throw new FlashSaleError("Flash sale not found.");
  return sale;
}

export function createFlashSale(input: FlashSaleInput) {
  return prisma.flashSale.create({ data: input });
}

async function requireFlashSale(id: string) {
  const existing = await prisma.flashSale.findUnique({ where: { id } });
  if (!existing) throw new FlashSaleError("Flash sale not found.");
  return existing;
}

export async function updateFlashSale(id: string, input: FlashSaleInput) {
  await requireFlashSale(id);
  return prisma.flashSale.update({ where: { id }, data: input });
}

export async function toggleFlashSaleActive(id: string) {
  const existing = await requireFlashSale(id);
  return prisma.flashSale.update({ where: { id }, data: { isActive: !existing.isActive } });
}

export async function deleteFlashSale(id: string) {
  await requireFlashSale(id);
  await prisma.flashSale.delete({ where: { id } });
}

/** Admin picker source — active products only, most recent first. */
export function listActiveProductsForPicker() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      currencyCode: true,
      seller: { select: { storeName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export interface FlashSaleItemInput {
  productId: string;
  discountPercent: number;
  stockLimit: number | null;
}

export async function addFlashSaleItem(flashSaleId: string, input: FlashSaleItemInput) {
  await requireFlashSale(flashSaleId);
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new FlashSaleError("Product not found.");
  const existing = await prisma.flashSaleItem.findUnique({
    where: { flashSaleId_productId: { flashSaleId, productId: input.productId } },
  });
  if (existing) throw new FlashSaleError("This product is already in this flash sale.");
  return prisma.flashSaleItem.create({
    data: {
      flashSaleId,
      productId: input.productId,
      discountPercent: input.discountPercent,
      stockLimit: input.stockLimit,
    },
  });
}

async function requireFlashSaleItem(id: string) {
  const existing = await prisma.flashSaleItem.findUnique({ where: { id } });
  if (!existing) throw new FlashSaleError("Flash sale item not found.");
  return existing;
}

export async function updateFlashSaleItem(
  id: string,
  input: { discountPercent: number; stockLimit: number | null },
) {
  await requireFlashSaleItem(id);
  return prisma.flashSaleItem.update({
    where: { id },
    data: { discountPercent: input.discountPercent, stockLimit: input.stockLimit },
  });
}

export async function removeFlashSaleItem(id: string) {
  await requireFlashSaleItem(id);
  await prisma.flashSaleItem.delete({ where: { id } });
}

// ── Storefront/checkout engine ───────────────────────────────────────────
// The only code in this file that runs on the hot path: resolving which
// price a shopper actually pays, and atomically claiming limited stock
// inside checkout's transaction. Never trust a frontend countdown or a
// pre-read soldCount — both are re-derived here from the database.

export interface ActiveFlashSaleItem {
  id: string;
  flashSaleId: string;
  discountPercent: number;
  stockLimit: number | null;
  soldCount: number;
  endsAt: Date;
}

export async function getActiveFlashSaleItemsForProducts(
  productIds: string[],
  now: Date = new Date(),
): Promise<Map<string, ActiveFlashSaleItem>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.flashSaleItem.findMany({
    where: {
      productId: { in: productIds },
      flashSale: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    },
    include: { flashSale: { select: { endsAt: true } } },
  });

  const byProduct = new Map<string, ActiveFlashSaleItem>();
  for (const row of rows) {
    if (row.stockLimit !== null && row.soldCount >= row.stockLimit) continue; // sold out
    const candidate: ActiveFlashSaleItem = {
      id: row.id,
      flashSaleId: row.flashSaleId,
      discountPercent: Number(row.discountPercent),
      stockLimit: row.stockLimit,
      soldCount: row.soldCount,
      endsAt: row.flashSale.endsAt,
    };
    // A product enrolled in more than one concurrently-active sale (an
    // admin misconfiguration, not a normal case) shows the deepest
    // discount — a customer should never see a worse price than advertised.
    const current = byProduct.get(row.productId);
    if (!current || candidate.discountPercent > current.discountPercent) {
      byProduct.set(row.productId, candidate);
    }
  }
  return byProduct;
}

export async function getActiveFlashSaleItemForProduct(productId: string, now: Date = new Date()) {
  const map = await getActiveFlashSaleItemsForProducts([productId], now);
  return map.get(productId) ?? null;
}

export function computeEffectivePrice(price: number, discountPercent: number): number {
  return Math.round(price * (1 - discountPercent / 100) * 100) / 100;
}

/** Shared by checkout, cart, and checkout-page previews so the price a
 * shopper is shown never drifts from the price checkout actually charges. */
export function resolveEffectivePrice(price: number, flash: ActiveFlashSaleItem | undefined | null): number {
  return flash ? computeEffectivePrice(price, flash.discountPercent) : price;
}

/**
 * Atomically increments soldCount, refusing when doing so would exceed
 * stockLimit. Expressed as a single UPDATE ... WHERE so Postgres evaluates
 * the guard against each row's current value under the transaction's own
 * lock — the one race-free way to do this, since Prisma's query builder
 * can't express "column + delta <= column" as a WHERE filter. Both bound
 * values are Prisma template parameters, not string interpolation.
 */
export async function claimFlashSaleStock(
  tx: Prisma.TransactionClient,
  flashSaleItemId: string,
  quantity: number,
) {
  const affected = await tx.$executeRaw`
    UPDATE "FlashSaleItem"
    SET "soldCount" = "soldCount" + ${quantity}
    WHERE "id" = ${flashSaleItemId}
      AND ("stockLimit" IS NULL OR "soldCount" + ${quantity} <= "stockLimit")
  `;
  if (affected === 0) {
    throw new FlashSaleError("This flash sale deal just sold out. Please review your cart.");
  }
}
