"use server";

import { revalidatePath } from "next/cache";
import { z, type ZodError } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { taxRuleSchema, shippingZoneSchema, shippingMethodSchema } from "@/server/validation/settings";
import * as settingsService from "@/server/services/settings";
import { SettingsError } from "@/server/services/settings";

export interface SettingsFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleSettingsError(err: unknown): SettingsFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof SettingsError) {
    return { error: err.message };
  }
  throw err;
}

function fieldErrors(error: ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// ── Tax rules ─────────────────────────────────────────────────────────

export async function createTaxRuleAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = taxRuleSchema.safeParse({
      countryCode: formData.get("countryCode"),
      name: formData.get("name"),
      ratePercent: formData.get("ratePercent"),
      appliesTo: formData.get("appliesTo"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const rule = await settingsService.createTaxRule({
      countryCode: parsed.data.countryCode,
      name: parsed.data.name,
      rate: parsed.data.ratePercent / 100,
      appliesTo: parsed.data.appliesTo,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.tax_rule_created",
      entityType: "TaxRule",
      entityId: rule.id,
      newValue: { countryCode: rule.countryCode, name: rule.name, rate: rule.rate.toString() },
    });

    revalidatePath("/admin/settings/taxes");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function updateTaxRuleAction(
  id: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = taxRuleSchema.safeParse({
      countryCode: formData.get("countryCode"),
      name: formData.get("name"),
      ratePercent: formData.get("ratePercent"),
      appliesTo: formData.get("appliesTo"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await settingsService.updateTaxRule(id, {
      countryCode: parsed.data.countryCode,
      name: parsed.data.name,
      rate: parsed.data.ratePercent / 100,
      appliesTo: parsed.data.appliesTo,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.tax_rule_updated",
      entityType: "TaxRule",
      entityId: id,
      newValue: { countryCode: parsed.data.countryCode, name: parsed.data.name, ratePercent: parsed.data.ratePercent },
    });

    revalidatePath("/admin/settings/taxes");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function toggleTaxRuleAction(
  id: string,
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const rule = await settingsService.toggleTaxRuleActive(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.tax_rule_toggled",
      entityType: "TaxRule",
      entityId: id,
      newValue: { isActive: rule.isActive },
    });

    revalidatePath("/admin/settings/taxes");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function deleteTaxRuleAction(
  id: string,
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    await settingsService.deleteTaxRule(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.tax_rule_deleted",
      entityType: "TaxRule",
      entityId: id,
    });

    revalidatePath("/admin/settings/taxes");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

// ── Shipping zones ────────────────────────────────────────────────────

export async function createShippingZoneAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = shippingZoneSchema.safeParse({
      name: formData.get("name"),
      countryCode: formData.get("countryCode"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const zone = await settingsService.createShippingZone(parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_zone_created",
      entityType: "ShippingZone",
      entityId: zone.id,
      newValue: parsed.data,
    });

    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function updateShippingZoneAction(
  id: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = shippingZoneSchema.safeParse({
      name: formData.get("name"),
      countryCode: formData.get("countryCode"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await settingsService.updateShippingZone(id, parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_zone_updated",
      entityType: "ShippingZone",
      entityId: id,
      newValue: parsed.data,
    });

    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function deleteShippingZoneAction(
  id: string,
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    await settingsService.deleteShippingZone(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_zone_deleted",
      entityType: "ShippingZone",
      entityId: id,
    });

    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

// ── Shipping methods ──────────────────────────────────────────────────

function parseShippingMethodForm(formData: FormData) {
  return shippingMethodSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    freeThreshold: formData.get("freeThreshold") || undefined,
    estimatedDaysMin: formData.get("estimatedDaysMin") || undefined,
    estimatedDaysMax: formData.get("estimatedDaysMax") || undefined,
  });
}

export async function createShippingMethodAction(
  zoneId: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = parseShippingMethodForm(formData);
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const method = await settingsService.createShippingMethod(zoneId, {
      name: parsed.data.name,
      price: parsed.data.price,
      freeThreshold: parsed.data.freeThreshold ?? null,
      estimatedDaysMin: parsed.data.estimatedDaysMin ?? null,
      estimatedDaysMax: parsed.data.estimatedDaysMax ?? null,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_method_created",
      entityType: "ShippingMethod",
      entityId: method.id,
      newValue: { zoneId, name: method.name, price: method.price.toString() },
    });

    revalidatePath(`/admin/settings/shipping/zones/${zoneId}`);
    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function updateShippingMethodAction(
  id: string,
  zoneId: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = parseShippingMethodForm(formData);
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await settingsService.updateShippingMethod(id, {
      name: parsed.data.name,
      price: parsed.data.price,
      freeThreshold: parsed.data.freeThreshold ?? null,
      estimatedDaysMin: parsed.data.estimatedDaysMin ?? null,
      estimatedDaysMax: parsed.data.estimatedDaysMax ?? null,
    });

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_method_updated",
      entityType: "ShippingMethod",
      entityId: id,
      newValue: parsed.data,
    });

    revalidatePath(`/admin/settings/shipping/zones/${zoneId}`);
    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function toggleShippingMethodAction(
  id: string,
  zoneId: string,
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const method = await settingsService.toggleShippingMethodActive(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_method_toggled",
      entityType: "ShippingMethod",
      entityId: id,
      newValue: { isActive: method.isActive },
    });

    revalidatePath(`/admin/settings/shipping/zones/${zoneId}`);
    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}

export async function deleteShippingMethodAction(
  id: string,
  zoneId: string,
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    await settingsService.deleteShippingMethod(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.shipping_method_deleted",
      entityType: "ShippingMethod",
      entityId: id,
    });

    revalidatePath(`/admin/settings/shipping/zones/${zoneId}`);
    revalidatePath("/admin/settings/shipping");
    return { success: true };
  } catch (err) {
    return handleSettingsError(err);
  }
}
