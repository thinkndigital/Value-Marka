import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/dal";

const CART_COOKIE = "vm_cart";

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: { images: { take: 1, orderBy: { sortOrder: "asc" as const } }, seller: true },
      },
      variant: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

/** Read-only lookup — safe to call from Server Components (no cookie writes). */
export async function getCurrentCart() {
  const user = await getCurrentUser();
  if (user) {
    return prisma.cart.findUnique({ where: { userId: user.id }, include: CART_INCLUDE });
  }

  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  return prisma.cart.findUnique({ where: { guestToken: token }, include: CART_INCLUDE });
}

/** Creates the cart (and its cookie, for guests) if needed — Server Actions only. */
export async function getOrCreateCart() {
  const user = await getCurrentUser();

  if (user) {
    const existing = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId: user.id } });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { guestToken: token } });
    if (existing) return existing;
  }

  const newToken = randomUUID();
  cookieStore.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return prisma.cart.create({ data: { guestToken: newToken } });
}

export async function getCartItemCount() {
  const cart = await getCurrentCart();
  if (!cart) return 0;
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}
