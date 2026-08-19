import "server-only";
import type { SellerStatus } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/server/db";
import type { sellerApplicationSchema } from "@/server/validation/seller";

export class SellerError extends Error {}

type ApplicationInput = z.infer<typeof sellerApplicationSchema>;

export function getSellerForUser(userId: string) {
  return prisma.seller.findUnique({
    where: { userId },
    include: { application: true },
  });
}

export async function submitSellerApplication(userId: string, input: ApplicationInput) {
  const existing = await prisma.seller.findUnique({ where: { userId } });
  if (existing) {
    throw new SellerError("You already have a seller account.");
  }

  const slugTaken = await prisma.seller.findUnique({
    where: { storeSlug: input.storeSlug },
  });
  if (slugTaken) {
    throw new SellerError("That store URL is already taken.");
  }

  return prisma.seller.create({
    data: {
      userId,
      storeName: input.storeName,
      storeSlug: input.storeSlug,
      countryCode: input.countryCode,
      description: input.description,
      status: "PENDING",
      application: {
        create: {
          businessType: input.businessType,
          taxId: input.taxId,
        },
      },
    },
    include: { application: true },
  });
}

export function listSellerApplications(status?: SellerStatus) {
  return prisma.seller.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      application: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

export function getSellerWithApplication(id: string) {
  return prisma.seller.findUnique({
    where: { id },
    include: {
      application: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      country: true,
    },
  });
}

export async function approveSellerApplication(sellerId: string, actorId: string) {
  const sellerRole = await prisma.role.findUniqueOrThrow({ where: { key: "SELLER" } });

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.update({
      where: { id: sellerId },
      data: { status: "APPROVED" },
    });

    await tx.sellerApplication.update({
      where: { sellerId },
      data: { status: "APPROVED", reviewedById: actorId, reviewedAt: new Date() },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_sellerId: {
          userId: seller.userId,
          roleId: sellerRole.id,
          sellerId: seller.id,
        },
      },
      create: { userId: seller.userId, roleId: sellerRole.id, sellerId: seller.id },
      update: {},
    });

    return seller;
  });
}

export async function rejectSellerApplication(
  sellerId: string,
  actorId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.update({
      where: { id: sellerId },
      data: { status: "REJECTED" },
    });

    await tx.sellerApplication.update({
      where: { sellerId },
      data: {
        status: "REJECTED",
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });

    return seller;
  });
}
