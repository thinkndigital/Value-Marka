import { z } from "zod";

export const couponSchema = z.object({
  code: z.string().trim().min(3).max(30),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value: z.coerce.number().min(0).default(0),
  minOrderTotal: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  usageLimitPerUser: z.coerce.number().int().min(1).optional(),
  startsAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endsAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});
