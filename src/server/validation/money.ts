import { z } from "zod";

/**
 * Money is validated and carried as a string end-to-end (form -> action ->
 * Prisma.Decimal) so it never passes through a JS `number` and risks
 * float-precision loss (ARCHITECTURE.md §3 "Money is server-side only").
 */
export function money({ min = 0 }: { min?: number } = {}) {
  return z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid amount, e.g. 19.99")
    .refine((v) => Number(v) >= min, `Must be at least ${min}`);
}
