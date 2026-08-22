import { z } from "zod";

export const bundleComponentSchema = z.object({
  componentProductId: z.string().trim().min(1, "Pick a product"),
  quantity: z.coerce.number().int().min(1, "Must be at least 1"),
});
