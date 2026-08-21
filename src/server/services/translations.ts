import "server-only";
import { prisma } from "@/server/db";

export class TranslationError extends Error {}

/**
 * entityType values this admin UI knows how to manage. Kept to just
 * "Category" for now — the only one with a real storefront read path
 * (getFeaturedCategories); extend this list only alongside a matching
 * resolveTranslationsFor() call at an actual read site, not speculatively.
 */
export const TRANSLATABLE_ENTITY_TYPES = ["Category"] as const;
export type TranslatableEntityType = (typeof TRANSLATABLE_ENTITY_TYPES)[number];

export function listTranslations(entityType?: string) {
  return prisma.translation.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: [{ entityType: "asc" }, { entityId: "asc" }, { locale: "asc" }, { field: "asc" }],
  });
}

export async function upsertTranslation(input: {
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
}) {
  return prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: {
        entityType: input.entityType,
        entityId: input.entityId,
        locale: input.locale,
        field: input.field,
      },
    },
    update: { value: input.value },
    create: input,
  });
}

export async function deleteTranslation(id: string) {
  const existing = await prisma.translation.findUnique({ where: { id } });
  if (!existing) throw new TranslationError("Translation not found.");
  await prisma.translation.delete({ where: { id } });
}

/**
 * Batch-resolves a single field's translations for many entities of the
 * same type/locale in one query — the real read path admin-managed
 * Translation rows feed into (used by the homepage's featured-categories
 * block). Returns a Map keyed by entityId; entities with no override are
 * simply absent from the map, so callers fall back to their base column.
 */
export async function resolveTranslationsFor(
  entityType: string,
  entityIds: string[],
  field: string,
  locale: string,
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();
  const rows = await prisma.translation.findMany({
    where: { entityType, entityId: { in: entityIds }, field, locale },
  });
  return new Map(rows.map((row) => [row.entityId, row.value]));
}
