import "server-only";
import { prisma } from "@/server/db";

export class ReviewError extends Error {}

export function listReviewsForProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export function listReviewsForUser(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, slug: true } } },
  });
}

interface ReviewInput {
  rating: number;
  title?: string;
  body?: string;
}

export async function createReview(userId: string, productId: string, input: ReviewInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "ACTIVE") {
    throw new ReviewError("This product is no longer available.");
  }

  const existing = await prisma.review.findFirst({ where: { userId, productId } });
  if (existing) {
    throw new ReviewError("You've already reviewed this product.");
  }

  return prisma.review.create({
    data: {
      productId,
      sellerId: product.sellerId,
      userId,
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
  });
}
