import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "MARKETING",
  "SHIPPING",
  "SALARIES",
  "SOFTWARE",
  "WAREHOUSE",
  "RENT",
  "PAYMENT_PROCESSING",
  "REFUNDS",
  "OPERATIONAL",
  "OTHER",
] as const;

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
  amount: z.coerce.number().positive(),
  currencyCode: z.string().length(3),
  incurredAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});
