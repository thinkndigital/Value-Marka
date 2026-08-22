import { z } from "zod";
import { money } from "./money";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.");

export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug,
  sku: z.string().trim().min(1).max(100),
  categoryId: z.string().min(1, "Select a category."),
  brandId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  shortDescription: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  price: money({ min: 0.01 }),
  costPrice: money({ min: 0 }),
  currencyCode: z.string().length(3),
  weightGrams: z.coerce.number().int().nonnegative().optional(),
});

// Product type is settable only at creation — not part of the shared
// productSchema above, so an edit form (which never renders a type field)
// can never silently reset an existing product's type back to the zod
// default on save.
export const productTypeSchema = z.enum(["SIMPLE", "DIGITAL", "BUNDLE"]);

export const stockAdjustmentSchema = z.object({
  warehouseId: z.string().min(1, "Select a warehouse."),
  delta: z.coerce.number().int().refine((v) => v !== 0, "Enter a non-zero amount."),
  reason: z.string().trim().min(2).max(300),
});
