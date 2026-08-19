import "server-only";
import { prisma } from "@/server/db";
import { getAvailableStock } from "./inventory";

export class CartError extends Error {}

export async function addToCart(
  cartId: string,
  productId: string,
  quantity: number,
  variantId?: string | null,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "ACTIVE") {
    throw new CartError("This product is no longer available.");
  }

  const cart = await prisma.cart.findUniqueOrThrow({ where: { id: cartId } });
  const existingItems = await prisma.cartItem.count({ where: { cartId } });
  if (existingItems > 0 && cart.currencyCode !== product.currencyCode) {
    throw new CartError(
      `Your cart already has items priced in ${cart.currencyCode}. Check out or clear your cart before adding items priced in ${product.currencyCode}.`,
    );
  }

  const available = await getAvailableStock(productId, variantId ?? null);
  // Not a findUnique on the compound key: variantId is nullable, and Postgres
  // does not treat NULL as equal to NULL for uniqueness — same reasoning as
  // Inventory (DATABASE.md §4).
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId, variantId: variantId ?? null },
  });
  const desiredQuantity = (existing?.quantity ?? 0) + quantity;
  if (desiredQuantity > available) {
    throw new CartError(
      available > 0
        ? `Only ${available} left in stock.`
        : "This product is out of stock.",
    );
  }

  await prisma.$transaction(async (tx) => {
    if (cart.currencyCode !== product.currencyCode && existingItems === 0) {
      await tx.cart.update({ where: { id: cartId }, data: { currencyCode: product.currencyCode } });
    }
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: desiredQuantity } });
    } else {
      await tx.cartItem.create({
        data: { cartId, productId, variantId: variantId ?? null, quantity },
      });
    }
  });
}

export async function updateCartItemQuantity(cartId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cartId) throw new CartError("Cart item not found.");

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
    return;
  }

  const available = await getAvailableStock(item.productId, item.variantId);
  if (quantity > available) {
    throw new CartError(available > 0 ? `Only ${available} left in stock.` : "Out of stock.");
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function removeCartItem(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cartId) throw new CartError("Cart item not found.");
  await prisma.cartItem.delete({ where: { id: itemId } });
}

/** Server-computed totals — the client never gets to declare a total (ARCHITECTURE.md §3). */
export function computeCartTotals(
  items: { quantity: number; product: { price: import("@prisma/client").Prisma.Decimal } }[],
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );
  return { subtotal: Math.round(subtotal * 100) / 100 };
}
