import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  assignRole,
  getUserForAdmin,
  listAssignableRoles,
  listUsersPage,
  removeRole,
  UserAdminError,
} from "@/server/services/users";

const PREFIX = "admin-users-test-";

let userId: string;
let customerRoleId: string;
let superAdminRoleId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Grant",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });
  userId = user.id;

  const customerRole = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
  customerRoleId = customerRole.id;
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  superAdminRoleId = superAdminRole.id;

  await prisma.userRole.create({ data: { userId, roleId: customerRoleId } });
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("admin user/role management", () => {
  it("lists the seeded system roles as assignable", async () => {
    const roles = await listAssignableRoles();
    expect(roles.some((r) => r.key === "SUPER_ADMIN")).toBe(true);
    expect(roles.some((r) => r.key === "CUSTOMER")).toBe(true);
  });

  it("finds the test user by search and shows their real role", async () => {
    const { items } = await listUsersPage(1, PREFIX);
    const found = items.find((u) => u.id === userId);
    expect(found).toBeDefined();
    expect(found?.roleKeys).toContain("CUSTOMER");
  });

  it("assigns a new role idempotently — no duplicate UserRole on repeat", async () => {
    await assignRole(userId, superAdminRoleId);
    await assignRole(userId, superAdminRoleId);

    const count = await prisma.userRole.count({ where: { userId, roleId: superAdminRoleId } });
    expect(count).toBe(1);

    const detail = await getUserForAdmin(userId);
    expect(detail?.roleKeys).toContain("SUPER_ADMIN");
  });

  it("removes a role that isn't the platform's last SUPER_ADMIN", async () => {
    const detail = await getUserForAdmin(userId);
    const superAdminUserRole = detail?.userRoles.find((r) => r.roleKey === "SUPER_ADMIN");
    expect(superAdminUserRole).toBeDefined();

    await removeRole(superAdminUserRole!.id);

    const stillThere = await prisma.userRole.findUnique({ where: { id: superAdminUserRole!.id } });
    expect(stillThere).toBeNull();
  });

  it("refuses to remove the platform's last SUPER_ADMIN", async () => {
    // Force a deterministic "exactly one SUPER_ADMIN" scenario regardless
    // of what's already seeded (e.g. a bootstrap admin from ADMIN_EMAIL —
    // see prisma/seed.ts): park every existing SUPER_ADMIN grant aside,
    // assign our disposable test user as the sole SUPER_ADMIN, verify the
    // guard fires, then restore exactly what was there before.
    const otherGrants = await prisma.userRole.findMany({ where: { roleId: superAdminRoleId } });
    for (const grant of otherGrants) {
      await prisma.userRole.delete({ where: { id: grant.id } });
    }

    const ownGrant = await prisma.userRole.create({ data: { userId, roleId: superAdminRoleId } });

    await expect(removeRole(ownGrant.id)).rejects.toBeInstanceOf(UserAdminError);

    await prisma.userRole.delete({ where: { id: ownGrant.id } });
    if (otherGrants.length > 0) {
      await prisma.userRole.createMany({
        data: otherGrants.map((g) => ({ userId: g.userId, roleId: g.roleId, sellerId: g.sellerId })),
      });
    }
  });
});
