"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { currencyUpdateSchema, exchangeRateSchema } from "@/server/validation/settings";
import * as currencyService from "@/server/services/currency";
import { CurrencyError } from "@/server/services/currency";

export interface CurrencyFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

function handleError(err: unknown): CurrencyFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof CurrencyError) {
    return { error: err.message };
  }
  throw err;
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function toggleCurrencyAction(
  code: string,
  _prevState: CurrencyFormState,
  _formData: FormData,
): Promise<CurrencyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const currency = await currencyService.toggleCurrencyActive(code);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.currency_toggled",
      entityType: "Currency",
      entityId: code,
      newValue: { isActive: currency.isActive },
    });

    revalidatePath("/admin/settings/currencies");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function updateCurrencyAction(
  code: string,
  _prevState: CurrencyFormState,
  formData: FormData,
): Promise<CurrencyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = currencyUpdateSchema.safeParse({
      name: formData.get("name"),
      symbol: formData.get("symbol"),
      decimalDigits: formData.get("decimalDigits"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await currencyService.updateCurrency(code, parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.currency_updated",
      entityType: "Currency",
      entityId: code,
      newValue: parsed.data,
    });

    revalidatePath("/admin/settings/currencies");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function createExchangeRateAction(
  _prevState: CurrencyFormState,
  formData: FormData,
): Promise<CurrencyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    const parsed = exchangeRateSchema.safeParse({
      fromCode: formData.get("fromCode"),
      toCode: formData.get("toCode"),
      rate: formData.get("rate"),
      effectiveAt: formData.get("effectiveAt"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const created = await currencyService.createExchangeRate(parsed.data);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.exchange_rate_created",
      entityType: "ExchangeRate",
      entityId: created.id,
      newValue: { fromCode: created.fromCode, toCode: created.toCode, rate: created.rate.toString() },
    });

    revalidatePath("/admin/settings/exchange-rates");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteExchangeRateAction(
  id: string,
  _prevState: CurrencyFormState,
  _formData: FormData,
): Promise<CurrencyFormState> {
  try {
    const actor = await requireCurrentUser();
    await requirePermission(actor.id, "settings.update");

    await currencyService.deleteExchangeRate(id);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "settings.exchange_rate_deleted",
      entityType: "ExchangeRate",
      entityId: id,
    });

    revalidatePath("/admin/settings/exchange-rates");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
