import { z } from "zod";

export const flashSaleSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(150),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "End date must be after the start date.",
    path: ["endsAt"],
  });

export const flashSaleItemSchema = z.object({
  productId: z.string().trim().min(1, "Pick a product"),
  discountPercent: z.coerce
    .number()
    .min(1, "Must be at least 1%")
    .max(90, "Cannot exceed 90%"),
  stockLimit: z.coerce.number().int().min(1).optional(),
});
