import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.");

export const sellerApplicationSchema = z.object({
  storeName: z.string().trim().min(2).max(150),
  storeSlug: slug,
  countryCode: z.string().length(2, "Select a country."),
  businessType: z.string().trim().min(2).max(100),
  taxId: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const rejectSellerSchema = z.object({
  reason: z.string().trim().min(5, "Explain why the application is being rejected.").max(500),
});
