import { z } from "zod";

export const rewardRuleSchema = z.object({
  pointsPerCurrencyUnit: z.coerce.number().positive("Must be greater than zero"),
  redemptionValue: z.coerce.number().positive("Must be greater than zero"),
  effectiveAt: z.coerce.date(),
});

export const redeemPointsSchema = z.object({
  points: z.coerce.number().int().positive("Enter a whole number of points"),
});
