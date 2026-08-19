import "server-only";
import { prisma } from "@/server/db";

async function getOrCreateWishlist(userId: string) {
  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wishlist.create({ data: { userId } });
}

export async function isProductWishlisted(userId: string, productId: string) {
  const item = await prisma.wishlistItem.findFirst({
    where: { productId, wishlist: { userId } },
  });
  return item !== null;
}

export async function listWishlistForUser(userId: string) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            include: {
              images: { take: 1, orderBy: { sortOrder: "asc" } },
              seller: { select: { storeName: true } },
            },
          },
        },
      },
    },
  });
  return wishlist?.items ?? [];
}

export async function addToWishlist(userId: string, productId: string) {
  const wishlist = await getOrCreateWishlist(userId);
  const existing = await prisma.wishlistItem.findFirst({
    where: { wishlistId: wishlist.id, productId },
  });
  if (existing) return existing;
  return prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
}

export async function removeFromWishlist(userId: string, productId: string) {
  const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wishlist) return;
  await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
}
