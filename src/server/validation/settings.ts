import { z } from "zod";

export const taxRuleSchema = z.object({
  countryCode: z.string().trim().length(2, "Pick a country"),
  name: z.string().trim().min(1, "Required").max(120),
  // The form collects a human percentage (e.g. 16 for 16%); the Server
  // Action divides by 100 before handing it to the service, which stores
  // the fraction (0.1600) in TaxRule.rate's Decimal(6,4) column — matching
  // what checkout.ts already reads.
  ratePercent: z.coerce.number().min(0).max(100),
  appliesTo: z.enum(["ALL", "PRODUCT", "SHIPPING"]),
});

export const shippingZoneSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  countryCode: z.string().trim().length(2, "Pick a country"),
});

export const currencyUpdateSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  symbol: z.string().trim().min(1, "Required").max(10),
  decimalDigits: z.coerce.number().int().min(0).max(4),
});

export const exchangeRateSchema = z.object({
  fromCode: z.string().trim().length(3, "Pick a currency"),
  toCode: z.string().trim().length(3, "Pick a currency"),
  rate: z.coerce.number().positive("Must be greater than zero"),
  effectiveAt: z.coerce.date(),
});

export const shippingMethodSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  price: z.coerce.number().min(0),
  freeThreshold: z.coerce.number().min(0).optional(),
  estimatedDaysMin: z.coerce.number().int().min(0).optional(),
  estimatedDaysMax: z.coerce.number().int().min(0).optional(),
});
