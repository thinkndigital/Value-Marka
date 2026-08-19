import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  ForbiddenError,
  assertSellerOwns,
  getUserPermissionKeys,
  requirePermission,
} from "@/server/rbac";

// Integration tests against a real, migrated + seeded Postgres database
// (DATABASE_URL from .env) — RBAC and seller isolation are the platform's
// core trust boundary (ARCHITECTURE.md §5/§6), so this is deliberately not
// mocked. Requires `npm run db:seed` to have been run.

const TEST_EMAIL_PREFIX = "rbac-test-";

let customerUserId: string;
let sellerStaffUserId: string;
let sellerAId: string;
let sellerBId: string;

beforeAll(async () => {
  const [customerRole, sellerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } }),
    prisma.role.findUniqueOrThrow({ where: { key: "SELLER" } }),
  ]);

  const customer = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}customer-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "Customer",
      passwordHash: "unused-in-this-test",
      roles: { create: { roleId: customerRole.id } },
    },
  });
  customerUserId = customer.id;

  const staffUser = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}staff-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "Seller",
      passwordHash: "unused-in-this-test",
    },
  });
  sellerStaffUserId = staffUser.id;

  const [sellerA, sellerB] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: staffUser.id,
        storeSlug: `rbac-test-store-a-${Date.now()}`,
        storeName: "RBAC Test Store A",
        countryCode: "JO",
      },
    }),
    // sellerB is owned by a different (throwaway) user account, since
    // Seller.userId is unique — this only exists to prove cross-seller
    // isolation, not to be a realistic second seller for staffUser.
    prisma.user
      .create({
        data: {
          email: `${TEST_EMAIL_PREFIX}owner-b-${Date.now()}@example.com`,
          firstName: "Test",
          lastName: "OwnerB",
          passwordHash: "unused-in-this-test",
        },
      })
      .then((ownerB) =>
        prisma.seller.create({
          data: {
            userId: ownerB.id,
            storeSlug: `rbac-test-store-b-${Date.now()}`,
            storeName: "RBAC Test Store B",
            countryCode: "JO",
          },
        }),
      ),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;

  // staffUser's SELLER role is scoped to Store A only.
  await prisma.userRole.create({
    data: { userId: staffUser.id, roleId: sellerRole.id, sellerId: sellerAId },
  });
});

afterAll(async () => {
  await prisma.userRole.deleteMany({
    where: { userId: { in: [customerUserId, sellerStaffUserId] } },
  });
  await prisma.seller.deleteMany({
    where: { id: { in: [sellerAId, sellerBId] } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

describe("permission resolution", () => {
  it("grants a global role's permissions with no seller scope", async () => {
    const keys = await getUserPermissionKeys(customerUserId);
    expect(keys.has("orders.read")).toBe(true);
    expect(keys.has("finance.read")).toBe(false);
  });

  it("does not grant seller-scoped permissions without the matching sellerId", async () => {
    const keys = await getUserPermissionKeys(sellerStaffUserId);
    expect(keys.size).toBe(0);
  });

  it("grants seller-scoped permissions when the caller passes that sellerId", async () => {
    const keys = await getUserPermissionKeys(sellerStaffUserId, sellerAId);
    expect(keys.has("products.create")).toBe(true);
  });

  it("does not leak seller-scoped permissions to a different seller", async () => {
    const keys = await getUserPermissionKeys(sellerStaffUserId, sellerBId);
    expect(keys.size).toBe(0);
  });

  it("requirePermission throws ForbiddenError when the permission is missing", async () => {
    await expect(
      requirePermission(customerUserId, "finance.read"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requirePermission resolves when the permission is present", async () => {
    await expect(
      requirePermission(customerUserId, "orders.read"),
    ).resolves.toBeUndefined();
  });
});

describe("assertSellerOwns", () => {
  it("passes when the entity belongs to the caller's seller", () => {
    expect(() => assertSellerOwns(sellerAId, sellerAId)).not.toThrow();
  });

  it("throws ForbiddenError when the entity belongs to a different seller", () => {
    expect(() => assertSellerOwns(sellerBId, sellerAId)).toThrow(
      ForbiddenError,
    );
  });
});
