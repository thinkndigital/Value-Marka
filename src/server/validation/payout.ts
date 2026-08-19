import { z } from "zod";

export const payoutRequestSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["STRIPE", "PAYPAL"]),
});
