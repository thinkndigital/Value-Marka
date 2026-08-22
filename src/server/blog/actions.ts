"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { blogPostSchema, blogPostUpdateSchema, blogCategorySchema } from "@/server/validation/blog";
import * as blogService from "@/server/services/blog";
import { BlogError } from "@/server/services/blog";

export interface BlogFormState {
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

function handleError(err: unknown): BlogFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof BlogError) {
    return { error: err.message };
  }
  throw err;
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function parsePostFormBase(formData: FormData) {
  return {
    titleEn: formData.get("titleEn"),
    titleAr: formData.get("titleAr"),
    excerptEn: formData.get("excerptEn"),
    excerptAr: formData.get("excerptAr"),
    bodyEn: formData.get("bodyEn"),
    bodyAr: formData.get("bodyAr"),
    coverImageUrl: formData.get("coverImageUrl"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    categoryId: formData.get("categoryId"),
    tags: formData.get("tags"),
  };
}

export async function createBlogPostAction(
  _prevState: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = blogPostSchema.safeParse({
      slug: formData.get("slug"),
      ...parsePostFormBase(formData),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const post = await blogService.createBlogPost(user.id, {
      ...parsed.data,
      tagSlugs: parsed.data.tags,
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.post_created",
      entityType: "BlogPost",
      entityId: post.id,
      newValue: { slug: post.slug, titleEn: post.titleEn },
    });

    revalidatePath("/admin/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function updateBlogPostAction(
  id: string,
  _prevState: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = blogPostUpdateSchema.safeParse(parsePostFormBase(formData));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    await blogService.updateBlogPost(id, { ...parsed.data, tagSlugs: parsed.data.tags });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.post_updated",
      entityType: "BlogPost",
      entityId: id,
    });

    revalidatePath("/admin/blog");
    revalidatePath(`/admin/blog/${id}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function publishBlogPostAction(
  id: string,
  _prevState: BlogFormState,
  _formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    const post = await blogService.setBlogPostStatus(id, "PUBLISHED");

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.post_published",
      entityType: "BlogPost",
      entityId: id,
    });

    revalidatePath("/admin/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function unpublishBlogPostAction(
  id: string,
  _prevState: BlogFormState,
  _formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    const post = await blogService.setBlogPostStatus(id, "DRAFT");

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.post_unpublished",
      entityType: "BlogPost",
      entityId: id,
    });

    revalidatePath("/admin/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteBlogPostAction(
  id: string,
  _prevState: BlogFormState,
  _formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    await blogService.deleteBlogPost(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.post_deleted",
      entityType: "BlogPost",
      entityId: id,
    });

    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function createBlogCategoryAction(
  _prevState: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    const parsed = blogCategorySchema.safeParse({
      slug: formData.get("slug"),
      nameEn: formData.get("nameEn"),
      nameAr: formData.get("nameAr"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

    const category = await blogService.createBlogCategory(parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.category_created",
      entityType: "BlogCategory",
      entityId: category.id,
    });

    revalidatePath("/admin/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteBlogCategoryAction(
  id: string,
  _prevState: BlogFormState,
  _formData: FormData,
): Promise<BlogFormState> {
  try {
    const user = await requireCmsUser();
    await blogService.deleteBlogCategory(id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "blog.category_deleted",
      entityType: "BlogCategory",
      entityId: id,
    });

    revalidatePath("/admin/blog");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
