import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  countryCode: z.string().length(2, "Select a country."),
  city: z.string().trim().min(1).max(150),
  addressLine: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
  isDefault: z.coerce.boolean().default(false),
});
