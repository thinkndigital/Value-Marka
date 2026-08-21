"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import * as crmService from "@/server/services/crm";

export interface SegmentFormState {
  error?: string;
  success?: boolean;
}

export async function createSegmentAction(
  _prevState: SegmentFormState,
  formData: FormData,
): Promise<SegmentFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "customers.update");

    const name = String(formData.get("name") ?? "").trim();
    const definitionRaw = String(formData.get("definition") ?? "");
    if (!name) return { error: "Give the segment a name." };

    let definition: object;
    try {
      definition = JSON.parse(definitionRaw);
    } catch {
      return { error: "Definition must be valid JSON." };
    }

    const segment = await crmService.createSegment(name, definition);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "segment.created",
      entityType: "CustomerSegment",
      entityId: segment.id,
      newValue: { name },
    });

    revalidatePath("/admin/segments");
    return { success: true };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function deleteSegmentAction(
  id: string,
  _prevState: SegmentFormState,
  _formData: FormData,
): Promise<SegmentFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "customers.update");
    await crmService.deleteSegment(id);

    revalidatePath("/admin/segments");
    return { success: true };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}
