import { z } from "zod";

export const navItemSchema = z.object({
  label: z.string().trim().min(1, "Required").max(80),
  url: z.string().trim().min(1, "Required").max(300),
});
