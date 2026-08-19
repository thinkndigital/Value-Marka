import { z } from "zod";

export const shipmentSchema = z.object({
  carrier: z.string().trim().min(1).max(100),
  trackingNumber: z.string().trim().min(1).max(100),
});

export const returnRequestSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});
