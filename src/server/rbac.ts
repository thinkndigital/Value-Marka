import "server-only";
import { prisma } from "@/server/db";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolves every permission a user holds. `sellerId` scopes the lookup to
 * that seller's staff roles in addition to the user's global roles — a
 * seller-surface caller passes their own sellerId; an admin-surface caller
 * omits it, since admin permissions are always global roles
 * (`UserRole.sellerId = null`).
 */
export async function getUserPermissionKeys(
  userId: string,
  sellerId?: string | null,
): Promise<Set<string>> {
  const userRoles = await prisma.userRole.findMany({
    where: sellerId
      ? { userId, OR: [{ sellerId: null }, { sellerId }] }
      : { userId, sellerId: null },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });

  const keys = new Set<string>();
  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      keys.add(rolePermission.permission.key);
    }
  }
  return keys;
}

export async function hasPermission(
  userId: string,
  permissionKey: string,
  sellerId?: string | null,
): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId, sellerId);
  return keys.has(permissionKey);
}

/**
 * The single server-side authorization gate (see ARCHITECTURE.md §6).
 * Hiding a button in the UI is a UX nicety; this is the boundary that
 * actually matters, and every Server Action / Route Handler that mutates or
 * reads privileged data must call it before doing anything else.
 */
export async function requirePermission(
  userId: string,
  permissionKey: string,
  sellerId?: string | null,
): Promise<void> {
  const allowed = await hasPermission(userId, permissionKey, sellerId);
  if (!allowed) {
    throw new ForbiddenError(`Missing permission: ${permissionKey}`);
  }
}

/**
 * Closes the "guess another seller's entity id" gap described in
 * ARCHITECTURE.md §5 — call this after loading any entity by id on a
 * seller-scoped surface, before allowing a read or mutation to proceed.
 */
export function assertSellerOwns(
  entitySellerId: string,
  callerSellerId: string,
): void {
  if (entitySellerId !== callerSellerId) {
    throw new ForbiddenError("This resource belongs to a different seller.");
  }
}
