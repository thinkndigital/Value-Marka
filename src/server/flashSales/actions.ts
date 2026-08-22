"use server";

import { revalidatePath } from "next/cache";
import { z, type ZodError } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { flashSaleSchema, flashSaleItemSchema } from "@/server/validation/flashSales";
import * as flashSaleService from "@/server/services/flashSales";
import { FlashSaleError } from "@/server/services/flashSales";

export interface FlashSaleFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleFlashSaleError(err: unknown): FlashSaleFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof FlashSaleError) {
    return { error: err.message };
  }
  throw err;
}

function fieldErrors(error: ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function createFlashSaleAction(
  _prevState: FlashSaleFormState,
  formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.create");

    const parsed = flashSaleSchema.safeParse({
      name: formData.get("name"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const sale = await flashSaleService.createFlashSale(parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.created",
      entityType: "FlashSale",
      entityId: sale.id,
      newValue: { name: sale.name, startsAt: sale.startsAt, endsAt: sale.endsAt },
    });

    revalidatePath("/admin/marketing/flash-sales");
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function updateFlashSaleAction(
  id: string,
  _prevState: FlashSaleFormState,
  formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.update");

    const parsed = flashSaleSchema.safeParse({
      name: formData.get("name"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await flashSaleService.updateFlashSale(id, parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.updated",
      entityType: "FlashSale",
      entityId: id,
      newValue: parsed.data,
    });

    revalidatePath(`/admin/marketing/flash-sales/${id}`);
    revalidatePath("/admin/marketing/flash-sales");
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function toggleFlashSaleAction(
  id: string,
  _prevState: FlashSaleFormState,
  _formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.update");

    const sale = await flashSaleService.toggleFlashSaleActive(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.toggled",
      entityType: "FlashSale",
      entityId: id,
      newValue: { isActive: sale.isActive },
    });

    revalidatePath(`/admin/marketing/flash-sales/${id}`);
    revalidatePath("/admin/marketing/flash-sales");
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function deleteFlashSaleAction(
  id: string,
  _prevState: FlashSaleFormState,
  _formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.delete");

    await flashSaleService.deleteFlashSale(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.deleted",
      entityType: "FlashSale",
      entityId: id,
    });

    revalidatePath("/admin/marketing/flash-sales");
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function addFlashSaleItemAction(
  flashSaleId: string,
  _prevState: FlashSaleFormState,
  formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.update");

    const parsed = flashSaleItemSchema.safeParse({
      productId: formData.get("productId"),
      discountPercent: formData.get("discountPercent"),
      stockLimit: formData.get("stockLimit") || undefined,
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const item = await flashSaleService.addFlashSaleItem(flashSaleId, {
      productId: parsed.data.productId,
      discountPercent: parsed.data.discountPercent,
      stockLimit: parsed.data.stockLimit ?? null,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.item_added",
      entityType: "FlashSaleItem",
      entityId: item.id,
      newValue: { flashSaleId, productId: parsed.data.productId, discountPercent: parsed.data.discountPercent },
    });

    revalidatePath(`/admin/marketing/flash-sales/${flashSaleId}`);
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function updateFlashSaleItemAction(
  id: string,
  flashSaleId: string,
  _prevState: FlashSaleFormState,
  formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.update");

    const parsed = flashSaleItemSchema
      .omit({ productId: true })
      .safeParse({
        discountPercent: formData.get("discountPercent"),
        stockLimit: formData.get("stockLimit") || undefined,
      });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await flashSaleService.updateFlashSaleItem(id, {
      discountPercent: parsed.data.discountPercent,
      stockLimit: parsed.data.stockLimit ?? null,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.item_updated",
      entityType: "FlashSaleItem",
      entityId: id,
      newValue: parsed.data,
    });

    revalidatePath(`/admin/marketing/flash-sales/${flashSaleId}`);
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}

export async function removeFlashSaleItemAction(
  id: string,
  flashSaleId: string,
  _prevState: FlashSaleFormState,
  _formData: FormData,
): Promise<FlashSaleFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "campaigns.update");

    await flashSaleService.removeFlashSaleItem(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "flash_sale.item_removed",
      entityType: "FlashSaleItem",
      entityId: id,
    });

    revalidatePath(`/admin/marketing/flash-sales/${flashSaleId}`);
    return { success: true };
  } catch (err) {
    return handleFlashSaleError(err);
  }
}
