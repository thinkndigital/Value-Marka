import { z } from "zod";

export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined)),
  fullName: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(5).max(30),
  countryCode: z.string().length(2, "Select a country."),
  city: z.string().trim().min(1).max(150),
  addressLine1: z.string().trim().min(3).max(300),
  addressLine2: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : undefined)),
  isDefault: z.coerce.boolean().default(false),
});
