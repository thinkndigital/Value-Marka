import "server-only";
import { prisma } from "@/server/db";

export class CurrencyError extends Error {}

export function listCurrencies() {
  return prisma.currency.findMany({ orderBy: { code: "asc" } });
}

export async function toggleCurrencyActive(code: string) {
  const existing = await prisma.currency.findUnique({ where: { code } });
  if (!existing) throw new CurrencyError("Currency not found.");
  return prisma.currency.update({ where: { code }, data: { isActive: !existing.isActive } });
}

export interface CurrencyInput {
  name: string;
  symbol: string;
  decimalDigits: number;
}

export async function updateCurrency(code: string, input: CurrencyInput) {
  const existing = await prisma.currency.findUnique({ where: { code } });
  if (!existing) throw new CurrencyError("Currency not found.");
  return prisma.currency.update({ where: { code }, data: input });
}

export function listExchangeRates(fromCode?: string, toCode?: string) {
  return prisma.exchangeRate.findMany({
    where: { ...(fromCode ? { fromCode } : {}), ...(toCode ? { toCode } : {}) },
    orderBy: [{ fromCode: "asc" }, { toCode: "asc" }, { effectiveAt: "desc" }],
  });
}

export interface ExchangeRateInput {
  fromCode: string;
  toCode: string;
  rate: number;
  effectiveAt: Date;
}

export async function createExchangeRate(input: ExchangeRateInput) {
  if (input.fromCode === input.toCode) {
    throw new CurrencyError("From and to currency must be different.");
  }
  return prisma.exchangeRate.create({ data: input });
}

/**
 * Append-only by design (spec: rate history must never be rewritten —
 * a past rate may already have been used to compute something real).
 * Deleting is only ever allowed for a rate that hasn't taken effect yet,
 * so this can only ever correct a typo before it could have been used.
 */
export async function deleteExchangeRate(id: string) {
  const existing = await prisma.exchangeRate.findUnique({ where: { id } });
  if (!existing) throw new CurrencyError("Exchange rate not found.");
  if (existing.effectiveAt <= new Date()) {
    throw new CurrencyError("This rate has already taken effect and can't be removed — add a new rate instead.");
  }
  await prisma.exchangeRate.delete({ where: { id } });
}

async function findRate(fromCode: string, toCode: string, atDate: Date) {
  return prisma.exchangeRate.findFirst({
    where: { fromCode, toCode, effectiveAt: { lte: atDate } },
    orderBy: { effectiveAt: "desc" },
  });
}

/**
 * The real conversion logic ExchangeRate existed for but nothing called.
 * Looks up the most recent rate effective at or before `atDate` (defaults
 * to now) — never today's rate for a past date, so this is safe to use
 * for historical display without silently redating old amounts. Falls
 * back to the inverse pair (1/rate) if only that direction is recorded,
 * since admins will naturally enter a pair once, not both directions.
 */
export async function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  atDate: Date = new Date(),
): Promise<number> {
  if (fromCode === toCode) return amount;

  const direct = await findRate(fromCode, toCode, atDate);
  if (direct) return amount * Number(direct.rate);

  const inverse = await findRate(toCode, fromCode, atDate);
  if (inverse) return amount / Number(inverse.rate);

  throw new CurrencyError(`No exchange rate available for ${fromCode} -> ${toCode}.`);
}
