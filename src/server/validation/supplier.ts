import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const supplierSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactName: optionalTrimmed(150),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  phone: optionalTrimmed(30),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  address: optionalTrimmed(300),
  paymentTerms: optionalTrimmed(150),
});
