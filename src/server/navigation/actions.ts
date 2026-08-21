"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { navItemSchema } from "@/server/validation/navigation";
import * as navigationService from "@/server/services/navigation";
import { NavigationError } from "@/server/services/navigation";

export interface NavFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireNavUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  await requirePermission(user.id, "cms.update");
  return user;
}

function handleNavError(err: unknown): NavFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof NavigationError) {
    return { error: err.message };
  }
  throw err;
}

function parseNavForm(formData: FormData) {
  return navItemSchema.safeParse({ label: formData.get("label"), url: formData.get("url") });
}

export async function createFooterNavItemAction(
  _prevState: NavFormState,
  formData: FormData,
): Promise<NavFormState> {
  try {
    const user = await requireNavUser();
    const parsed = parseNavForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const item = await navigationService.createFooterNavItem(parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "navigation.footer_item.created",
      entityType: "NavigationItem",
      entityId: item.id,
    });

    revalidatePath("/admin/cms/navigation");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleNavError(err);
  }
}

export async function updateFooterNavItemAction(
  id: string,
  _prevState: NavFormState,
  formData: FormData,
): Promise<NavFormState> {
  try {
    const user = await requireNavUser();
    const parsed = parseNavForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await navigationService.updateFooterNavItem(id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "navigation.footer_item.updated",
      entityType: "NavigationItem",
      entityId: id,
    });

    revalidatePath("/admin/cms/navigation");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleNavError(err);
  }
}

export async function reorderFooterNavItemAction(
  id: string,
  direction: "up" | "down",
  _prevState: NavFormState,
  _formData: FormData,
): Promise<NavFormState> {
  try {
    await requireNavUser();
    await navigationService.reorderFooterNavItem(id, direction);
    revalidatePath("/admin/cms/navigation");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleNavError(err);
  }
}

export async function deleteFooterNavItemAction(
  id: string,
  _prevState: NavFormState,
  _formData: FormData,
): Promise<NavFormState> {
  try {
    const user = await requireNavUser();
    await navigationService.deleteFooterNavItem(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "navigation.footer_item.deleted",
      entityType: "NavigationItem",
      entityId: id,
    });

    revalidatePath("/admin/cms/navigation");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleNavError(err);
  }
}
