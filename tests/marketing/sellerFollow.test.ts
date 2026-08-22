import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as sellerFollow from "@/server/services/sellerFollow";

const PREFIX = "seller-follow-test-";

let customerId: string;
let sellerId: string;

beforeAll(async () => {
  const [customer, sellerOwner] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}customer-${Date.now()}@example.com`,
        firstName: "Follow",
        lastName: "Customer",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "Follow",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
  ]);
  customerId = customer.id;

  const seller = await prisma.seller.create({
    data: {
      userId: sellerOwner.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Follow Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;
});

afterAll(async () => {
  await prisma.sellerFollow.deleteMany({ where: { userId: customerId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("seller follow", () => {
  it("is not following by default", async () => {
    await expect(sellerFollow.isFollowingSeller(customerId, sellerId)).resolves.toBe(false);
    await expect(sellerFollow.getSellerFollowerCount(sellerId)).resolves.toBe(0);
  });

  it("follows a seller", async () => {
    await sellerFollow.followSeller(customerId, sellerId);
    await expect(sellerFollow.isFollowingSeller(customerId, sellerId)).resolves.toBe(true);
    await expect(sellerFollow.getSellerFollowerCount(sellerId)).resolves.toBe(1);
  });

  it("following twice is idempotent — no duplicate row, count stays 1", async () => {
    await sellerFollow.followSeller(customerId, sellerId);
    await expect(sellerFollow.getSellerFollowerCount(sellerId)).resolves.toBe(1);

    const rows = await prisma.sellerFollow.findMany({ where: { userId: customerId, sellerId } });
    expect(rows).toHaveLength(1);
  });

  it("lists the followed seller for the customer", async () => {
    const followed = await sellerFollow.listFollowedSellersForUser(customerId);
    expect(followed).toHaveLength(1);
    expect(followed[0].seller.storeName).toBe("Follow Test Store");
  });

  it("unfollows a seller", async () => {
    await sellerFollow.unfollowSeller(customerId, sellerId);
    await expect(sellerFollow.isFollowingSeller(customerId, sellerId)).resolves.toBe(false);
    await expect(sellerFollow.getSellerFollowerCount(sellerId)).resolves.toBe(0);
  });

  it("unfollowing when not following is a safe no-op", async () => {
    await expect(sellerFollow.unfollowSeller(customerId, sellerId)).resolves.toBeUndefined();
  });
});
