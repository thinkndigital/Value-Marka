import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.");

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Required").max(150),
  slug,
  parentId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  sortOrder: z.coerce.number().int().default(0),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Required").max(150),
  slug,
});
