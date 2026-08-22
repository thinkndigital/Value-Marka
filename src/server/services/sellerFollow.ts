import "server-only";
import { prisma } from "@/server/db";

export async function isFollowingSeller(userId: string, sellerId: string) {
  const follow = await prisma.sellerFollow.findUnique({
    where: { userId_sellerId: { userId, sellerId } },
  });
  return follow !== null;
}

export async function followSeller(userId: string, sellerId: string) {
  return prisma.sellerFollow.upsert({
    where: { userId_sellerId: { userId, sellerId } },
    update: {},
    create: { userId, sellerId },
  });
}

export async function unfollowSeller(userId: string, sellerId: string) {
  await prisma.sellerFollow.deleteMany({ where: { userId, sellerId } });
}

export function getSellerFollowerCount(sellerId: string) {
  return prisma.sellerFollow.count({ where: { sellerId } });
}

export async function listFollowedSellersForUser(userId: string) {
  const follows = await prisma.sellerFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        select: {
          storeSlug: true,
          storeName: true,
          logoUrl: true,
          description: true,
          _count: { select: { products: { where: { status: "ACTIVE" } }, followers: true } },
        },
      },
    },
  });
  return follows.map((f) => ({ followedAt: f.createdAt, seller: f.seller }));
}
