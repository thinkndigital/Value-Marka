"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { assignRoleSchema } from "@/server/validation/users";
import * as userService from "@/server/services/users";
import { UserAdminError } from "@/server/services/users";

export interface UserRoleActionState {
  error?: string;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleError(err: unknown): UserRoleActionState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof UserAdminError) {
    return { error: err.message };
  }
  throw err;
}

export async function assignRoleAction(
  targetUserId: string,
  _prevState: UserRoleActionState,
  formData: FormData,
): Promise<UserRoleActionState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "users.update");

    const parsed = assignRoleSchema.safeParse({ roleId: formData.get("roleId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid role" };
    }

    await userService.assignRole(targetUserId, parsed.data.roleId);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.role_assigned",
      entityType: "User",
      entityId: targetUserId,
      newValue: { roleId: parsed.data.roleId },
    });

    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function removeRoleAction(
  targetUserId: string,
  userRoleId: string,
  _prevState: UserRoleActionState,
  _formData: FormData,
): Promise<UserRoleActionState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "users.update");

    await userService.removeRole(userRoleId);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.role_removed",
      entityType: "User",
      entityId: targetUserId,
      oldValue: { userRoleId },
    });

    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
