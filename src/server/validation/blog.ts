import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.");

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const blogPostSchema = z.object({
  slug,
  titleEn: z.string().trim().min(1, "Required").max(200),
  titleAr: z.string().trim().min(1, "Required").max(200),
  excerptEn: optionalTrimmed(400),
  excerptAr: optionalTrimmed(400),
  bodyEn: z.string().trim().min(1, "Required").max(50000),
  bodyAr: z.string().trim().min(1, "Required").max(50000),
  coverImageUrl: optionalTrimmed(2000),
  seoTitle: optionalTrimmed(200),
  seoDescription: optionalTrimmed(400),
  categoryId: optionalTrimmed(100),
  tags: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean),
    ),
});

export const blogPostUpdateSchema = blogPostSchema.omit({ slug: true });

export const blogCategorySchema = z.object({
  slug,
  nameEn: z.string().trim().min(1, "Required").max(120),
  nameAr: z.string().trim().min(1, "Required").max(120),
});
