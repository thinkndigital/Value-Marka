"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { translationSchema } from "@/server/validation/translations";
import * as translationService from "@/server/services/translations";
import { TranslationError } from "@/server/services/translations";

export interface TranslationFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireTranslationUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  await requirePermission(user.id, "cms.update");
  return user;
}

function handleTranslationError(err: unknown): TranslationFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof TranslationError) {
    return { error: err.message };
  }
  throw err;
}

export async function upsertTranslationAction(
  _prevState: TranslationFormState,
  formData: FormData,
): Promise<TranslationFormState> {
  try {
    const user = await requireTranslationUser();
    const parsed = translationSchema.safeParse({
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      locale: formData.get("locale"),
      field: formData.get("field"),
      value: formData.get("value"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const translation = await translationService.upsertTranslation(parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "translation.upserted",
      entityType: "Translation",
      entityId: translation.id,
    });

    revalidatePath("/admin/cms/translations");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleTranslationError(err);
  }
}

export async function deleteTranslationAction(
  id: string,
  _prevState: TranslationFormState,
  _formData: FormData,
): Promise<TranslationFormState> {
  try {
    const user = await requireTranslationUser();
    await translationService.deleteTranslation(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "translation.deleted",
      entityType: "Translation",
      entityId: id,
    });

    revalidatePath("/admin/cms/translations");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleTranslationError(err);
  }
}
