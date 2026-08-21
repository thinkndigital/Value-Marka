import { z } from "zod";
import { TRANSLATABLE_ENTITY_TYPES } from "@/server/services/translations";
import { routing } from "@/i18n/routing";

export const translationSchema = z.object({
  entityType: z.enum(TRANSLATABLE_ENTITY_TYPES),
  entityId: z.string().trim().min(1, "Required"),
  locale: z.enum(routing.locales),
  field: z.string().trim().min(1, "Required").max(60),
  value: z.string().trim().min(1, "Required").max(500),
});
