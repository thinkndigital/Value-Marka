import { z } from "zod";

export const heroContentSchema = z.object({
  kicker: z.string().trim().min(1, "Required").max(80),
  title: z.string().trim().min(1, "Required").max(200),
  subtitle: z.string().trim().min(1, "Required").max(400),
  ctaPrimaryLabel: z.string().trim().min(1, "Required").max(60),
  ctaPrimaryHref: z.string().trim().min(1, "Required").max(300),
  ctaSecondaryLabel: z.string().trim().min(1, "Required").max(60),
  ctaSecondaryHref: z.string().trim().min(1, "Required").max(300),
});

export const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(48),
});

const pageSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.");

export const cmsPageSchema = z.object({
  slug: pageSlug,
  seoTitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  seoDescription: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v ? v : undefined)),
  body: z.string().trim().min(1, "Required").max(20000),
});

export const cmsPageUpdateSchema = cmsPageSchema.omit({ slug: true });

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const announcementContentSchema = z
  .object({
    textEn: z.string().trim().min(1, "Required").max(300),
    textAr: z.string().trim().min(1, "Required").max(300),
    link: optionalTrimmed(300),
    startDate: optionalTrimmed(20),
    endDate: optionalTrimmed(20),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    { message: "End date must be on or after the start date.", path: ["endDate"] },
  );

export const popupContentSchema = z
  .object({
    titleEn: z.string().trim().min(1, "Required").max(150),
    titleAr: z.string().trim().min(1, "Required").max(150),
    bodyEn: z.string().trim().min(1, "Required").max(1000),
    bodyAr: z.string().trim().min(1, "Required").max(1000),
    imageUrl: optionalTrimmed(2000),
    ctaLabelEn: optionalTrimmed(60),
    ctaLabelAr: optionalTrimmed(60),
    ctaHref: optionalTrimmed(300),
    target: z.enum(["ALL", "GUEST", "CUSTOMER"]),
    startDate: optionalTrimmed(20),
    endDate: optionalTrimmed(20),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    { message: "End date must be on or after the start date.", path: ["endDate"] },
  );

export const bannerContentSchema = z.object({
  headline: z.string().trim().min(1, "Required").max(150),
  subheadline: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  href: z.string().trim().min(1, "Required").max(300),
});
