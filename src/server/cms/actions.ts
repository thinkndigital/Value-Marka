"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import {
  heroContentSchema,
  limitSchema,
  bannerContentSchema,
  announcementContentSchema,
  cmsPageSchema,
  cmsPageUpdateSchema,
} from "@/server/validation/cms";
import * as cmsService from "@/server/services/cms";
import { CmsError } from "@/server/services/cms";

export interface CmsFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

async function requireCmsUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  await requirePermission(user.id, "cms.update");
  return user;
}

function handleCmsError(err: unknown): CmsFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof CmsError) {
    return { error: err.message };
  }
  throw err;
}

export async function updateHeroAction(
  locale: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = heroContentSchema.safeParse({
      kicker: formData.get("kicker"),
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
      ctaPrimaryLabel: formData.get("ctaPrimaryLabel"),
      ctaPrimaryHref: formData.get("ctaPrimaryHref"),
      ctaSecondaryLabel: formData.get("ctaSecondaryLabel"),
      ctaSecondaryHref: formData.get("ctaSecondaryHref"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await cmsService.upsertHeroContent(locale, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.hero.updated",
      entityType: "CmsBlock",
      entityId: `homepage.hero:${locale}`,
    });

    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function updateLimitAction(
  key: "homepage.featured_categories" | "homepage.featured_products",
  locale: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = limitSchema.safeParse({ limit: formData.get("limit") });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await cmsService.upsertLimitBlock(key, locale, parsed.data.limit);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.limit.updated",
      entityType: "CmsBlock",
      entityId: `${key}:${locale}`,
    });

    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

function parseBannerForm(formData: FormData) {
  return bannerContentSchema.safeParse({
    headline: formData.get("headline"),
    subheadline: formData.get("subheadline"),
    imageUrl: formData.get("imageUrl"),
    href: formData.get("href"),
  });
}

export async function createBannerAction(
  locale: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = parseBannerForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const banner = await cmsService.createBanner(locale, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.banner.created",
      entityType: "CmsBlock",
      entityId: banner.id,
    });

    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function updateBannerAction(
  id: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = parseBannerForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await cmsService.updateBanner(id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.banner.updated",
      entityType: "CmsBlock",
      entityId: id,
    });

    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function toggleBannerAction(
  id: string,
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    await requireCmsUser();
    await cmsService.toggleBannerActive(id);
    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function reorderBannerAction(
  id: string,
  direction: "up" | "down",
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    await requireCmsUser();
    await cmsService.reorderBanner(id, direction);
    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function deleteBannerAction(
  id: string,
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    await cmsService.deleteBanner(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.banner.deleted",
      entityType: "CmsBlock",
      entityId: id,
    });

    revalidatePath("/admin/cms/homepage");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

// ── Announcement bar ─────────────────────────────────────────────────────

function parseAnnouncementForm(formData: FormData) {
  return announcementContentSchema.safeParse({
    textEn: formData.get("textEn"),
    textAr: formData.get("textAr"),
    link: formData.get("link"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
}

export async function createAnnouncementAction(
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = parseAnnouncementForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const announcement = await cmsService.createAnnouncement(parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.announcement.created",
      entityType: "CmsBlock",
      entityId: announcement.id,
    });

    revalidatePath("/admin/cms/announcement");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function updateAnnouncementAction(
  id: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = parseAnnouncementForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await cmsService.updateAnnouncement(id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.announcement.updated",
      entityType: "CmsBlock",
      entityId: id,
    });

    revalidatePath("/admin/cms/announcement");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function toggleAnnouncementAction(
  id: string,
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    await requireCmsUser();
    await cmsService.toggleAnnouncementActive(id);
    revalidatePath("/admin/cms/announcement");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function reorderAnnouncementAction(
  id: string,
  direction: "up" | "down",
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    await requireCmsUser();
    await cmsService.reorderAnnouncement(id, direction);
    revalidatePath("/admin/cms/announcement");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function deleteAnnouncementAction(
  id: string,
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    await cmsService.deleteAnnouncement(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.announcement.deleted",
      entityType: "CmsBlock",
      entityId: id,
    });

    revalidatePath("/admin/cms/announcement");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

// ── CmsPage (landing pages) ─────────────────────────────────────────────

export async function createCmsPageAction(
  locale: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = cmsPageSchema.safeParse({
      slug: formData.get("slug"),
      seoTitle: formData.get("seoTitle"),
      seoDescription: formData.get("seoDescription"),
      body: formData.get("body"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const page = await cmsService.createCmsPage({ ...parsed.data, locale });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.page.created",
      entityType: "CmsPage",
      entityId: page.id,
      newValue: { slug: page.slug },
    });

    revalidatePath("/admin/cms/pages");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function updateCmsPageAction(
  id: string,
  locale: string,
  _prevState: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = cmsPageUpdateSchema.safeParse({
      seoTitle: formData.get("seoTitle"),
      seoDescription: formData.get("seoDescription"),
      body: formData.get("body"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await cmsService.updateCmsPage(id, { ...parsed.data, locale });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.page.updated",
      entityType: "CmsPage",
      entityId: id,
    });

    revalidatePath("/admin/cms/pages");
    revalidatePath(`/admin/cms/pages/${id}`);
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function setCmsPageStatusAction(
  id: string,
  status: "DRAFT" | "PUBLISHED",
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    const page = await cmsService.setCmsPageStatus(id, status);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: status === "PUBLISHED" ? "cms.page.published" : "cms.page.unpublished",
      entityType: "CmsPage",
      entityId: id,
    });

    revalidatePath("/admin/cms/pages");
    revalidatePath(`/page/${page.slug}`);
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}

export async function deleteCmsPageAction(
  id: string,
  _prevState: CmsFormState,
  _formData: FormData,
): Promise<CmsFormState> {
  try {
    const user = await requireCmsUser();
    await cmsService.deleteCmsPage(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "cms.page.deleted",
      entityType: "CmsPage",
      entityId: id,
    });

    revalidatePath("/admin/cms/pages");
    return { success: true };
  } catch (err) {
    return handleCmsError(err);
  }
}
