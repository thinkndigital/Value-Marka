import "server-only";
import type { TaxAppliesTo } from "@prisma/client";
import { prisma } from "@/server/db";

export class SettingsError extends Error {}

// ── Tax rules — real engine already lives in checkout.ts (sums active
// ALL/PRODUCT rules for the shipping address's country); this is just the
// admin CRUD surface for the rows it reads. ─────────────────────────────

export function listTaxRules() {
  return prisma.taxRule.findMany({
    include: { country: { select: { name: true, code: true } } },
    orderBy: [{ countryCode: "asc" }, { name: "asc" }],
  });
}

export function getTaxRule(id: string) {
  return prisma.taxRule.findUnique({ where: { id } });
}

export interface TaxRuleInput {
  countryCode: string;
  name: string;
  rate: number;
  appliesTo: TaxAppliesTo;
}

export function createTaxRule(input: TaxRuleInput) {
  return prisma.taxRule.create({ data: input });
}

export async function updateTaxRule(id: string, input: TaxRuleInput) {
  const existing = await prisma.taxRule.findUnique({ where: { id } });
  if (!existing) throw new SettingsError("Tax rule not found.");
  return prisma.taxRule.update({ where: { id }, data: input });
}

export async function toggleTaxRuleActive(id: string) {
  const existing = await prisma.taxRule.findUnique({ where: { id } });
  if (!existing) throw new SettingsError("Tax rule not found.");
  return prisma.taxRule.update({ where: { id }, data: { isActive: !existing.isActive } });
}

export async function deleteTaxRule(id: string) {
  const existing = await prisma.taxRule.findUnique({ where: { id } });
  if (!existing) throw new SettingsError("Tax rule not found.");
  await prisma.taxRule.delete({ where: { id } });
}

// ── Shipping zones/methods — real engine already lives in checkout.ts
// (cheapest active platform-wide method for the country, free above
// freeThreshold); this is the admin CRUD surface for those rows. ────────

export function listShippingZones() {
  return prisma.shippingZone.findMany({
    include: {
      country: { select: { name: true, code: true } },
      methods: { orderBy: { price: "asc" } },
    },
    orderBy: { name: "asc" },
  });
}

export function getShippingZone(id: string) {
  return prisma.shippingZone.findUnique({
    where: { id },
    include: { methods: { orderBy: { price: "asc" } } },
  });
}

export interface ShippingZoneInput {
  name: string;
  countryCode: string;
}

export function createShippingZone(input: ShippingZoneInput) {
  return prisma.shippingZone.create({ data: input });
}

export async function updateShippingZone(id: string, input: ShippingZoneInput) {
  const existing = await prisma.shippingZone.findUnique({ where: { id } });
  if (!existing) throw new SettingsError("Shipping zone not found.");
  return prisma.shippingZone.update({ where: { id }, data: input });
}

export async function deleteShippingZone(id: string) {
  const methodCount = await prisma.shippingMethod.count({ where: { zoneId: id } });
  if (methodCount > 0) {
    throw new SettingsError("Remove this zone's shipping methods first.");
  }
  await prisma.shippingZone.delete({ where: { id } });
}

export function getShippingMethod(id: string) {
  return prisma.shippingMethod.findUnique({ where: { id } });
}

export interface ShippingMethodInput {
  name: string;
  price: number;
  freeThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export async function createShippingMethod(zoneId: string, input: ShippingMethodInput) {
  const zone = await prisma.shippingZone.findUnique({ where: { id: zoneId } });
  if (!zone) throw new SettingsError("Shipping zone not found.");
  // Platform-wide only (sellerId left null) — matches checkout.ts's
  // documented assumption that a seller-specific rate would break the
  // proportional shippingShare split across a multi-seller order.
  return prisma.shippingMethod.create({ data: { ...input, zoneId } });
}

async function requireShippingMethod(id: string) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw new SettingsError("Shipping method not found.");
  return existing;
}

export async function updateShippingMethod(id: string, input: ShippingMethodInput) {
  await requireShippingMethod(id);
  return prisma.shippingMethod.update({ where: { id }, data: input });
}

export async function toggleShippingMethodActive(id: string) {
  const existing = await requireShippingMethod(id);
  return prisma.shippingMethod.update({ where: { id }, data: { isActive: !existing.isActive } });
}

export async function deleteShippingMethod(id: string) {
  await requireShippingMethod(id);
  await prisma.shippingMethod.delete({ where: { id } });
}
