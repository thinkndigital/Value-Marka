import "server-only";
import { prisma } from "@/server/db";
import { DEFAULT_PAGE_SIZE, paginate } from "@/server/pagination";

export class UserAdminError extends Error {}

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
  roleKeys: string[];
}

function toListItem(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
  roles: { role: { key: string } }[];
}): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    createdAt: user.createdAt,
    roleKeys: user.roles.map((r) => r.role.key),
  };
}

/** Platform-wide user directory for the admin Users page — every user, not just customers (contrast crm.ts's listCustomers). */
export async function listUsersPage(page = 1, search = "", pageSize = DEFAULT_PAGE_SIZE) {
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return paginate(users.map(toListItem), total, page, pageSize);
}

export interface AdminUserDetail extends AdminUserListItem {
  userRoles: { id: string; roleId: string; roleKey: string; roleName: string; sellerId: string | null }[];
}

export async function getUserForAdmin(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
      roles: {
        select: { id: true, roleId: true, sellerId: true, role: { select: { key: true, name: true } } },
      },
    },
  });
  if (!user) return null;

  return {
    ...toListItem({ ...user, roles: user.roles.map((r) => ({ role: r.role })) }),
    userRoles: user.roles.map((r) => ({
      id: r.id,
      roleId: r.roleId,
      roleKey: r.role.key,
      roleName: r.role.name,
      sellerId: r.sellerId,
    })),
  };
}

export function listAssignableRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true } });
}

/** Idempotent — assigning a role the user already has is a no-op, not a duplicate row (UserRole's unique constraint would otherwise throw). */
export async function assignRole(userId: string, roleId: string) {
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId, sellerId: null } });
  if (existing) return existing;
  return prisma.userRole.create({ data: { userId, roleId } });
}

/**
 * Blocks removing the platform's last SUPER_ADMIN — without this a super
 * admin could revoke their own (or the only other) super-admin role and
 * lock every operator out of the RBAC-gated admin surface with no UI path
 * back in (the same bootstrap-from-env-vars path in prisma/seed.ts still
 * recovers it, but that requires a redeploy, not a click).
 */
export async function removeRole(userRoleId: string) {
  const userRole = await prisma.userRole.findUnique({
    where: { id: userRoleId },
    select: { roleId: true, role: { select: { key: true } } },
  });
  if (!userRole) return;

  if (userRole.role.key === "SUPER_ADMIN") {
    const superAdminCount = await prisma.userRole.count({ where: { roleId: userRole.roleId } });
    if (superAdminCount <= 1) {
      throw new UserAdminError("Cannot remove the platform's last Super Admin.");
    }
  }

  await prisma.userRole.delete({ where: { id: userRoleId } });
}
