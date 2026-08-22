"use client";

import { useActionState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { BlogFormState } from "@/server/blog/actions";

type BlogAction = (state: BlogFormState, formData: FormData) => Promise<BlogFormState>;

interface BlogPostInitial {
  slug?: string;
  titleEn: string;
  titleAr: string;
  excerptEn?: string | null;
  excerptAr?: string | null;
  bodyEn: string;
  bodyAr: string;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  categoryId?: string | null;
  tags?: string;
}

export function BlogPostForm({
  action,
  categories,
  initial,
  includeSlug = false,
  submitLabel = "Save post",
  redirectTo,
}: {
  action: BlogAction;
  categories: { id: string; nameEn: string }[];
  initial?: BlogPostInitial;
  includeSlug?: boolean;
  submitLabel?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState<BlogFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success && redirectTo) router.push(redirectTo);
  }, [state.success, redirectTo, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {includeSlug ? (
        <Input
          id="slug"
          name="slug"
          label="Slug"
          placeholder="how-to-choose-a-seller"
          required
          defaultValue={initial?.slug}
          error={state.fieldErrors?.slug?.[0]}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="titleEn"
          name="titleEn"
          label="English title"
          required
          defaultValue={initial?.titleEn}
          error={state.fieldErrors?.titleEn?.[0]}
        />
        <Input
          id="titleAr"
          name="titleAr"
          label="Arabic title"
          dir="rtl"
          required
          defaultValue={initial?.titleAr}
          error={state.fieldErrors?.titleAr?.[0]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="excerptEn"
          name="excerptEn"
          label="English excerpt (optional)"
          defaultValue={initial?.excerptEn ?? undefined}
          error={state.fieldErrors?.excerptEn?.[0]}
        />
        <Input
          id="excerptAr"
          name="excerptAr"
          label="Arabic excerpt (optional)"
          dir="rtl"
          defaultValue={initial?.excerptAr ?? undefined}
          error={state.fieldErrors?.excerptAr?.[0]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bodyEn" className="font-display text-sm font-semibold text-text-primary">
            English body
          </label>
          <textarea
            id="bodyEn"
            name="bodyEn"
            rows={10}
            required
            defaultValue={initial?.bodyEn}
            className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary"
          />
          {state.fieldErrors?.bodyEn?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.bodyEn[0]}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bodyAr" className="font-display text-sm font-semibold text-text-primary">
            Arabic body
          </label>
          <textarea
            id="bodyAr"
            name="bodyAr"
            rows={10}
            dir="rtl"
            required
            defaultValue={initial?.bodyAr}
            className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary"
          />
          {state.fieldErrors?.bodyAr?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.bodyAr[0]}</p>
          ) : null}
        </div>
      </div>
      <Input
        id="coverImageUrl"
        name="coverImageUrl"
        label="Cover image URL (optional)"
        defaultValue={initial?.coverImageUrl ?? undefined}
        error={state.fieldErrors?.coverImageUrl?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="font-display text-sm font-semibold text-text-primary">
          Category (optional)
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={initial?.categoryId ?? ""}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
      </div>
      <Input
        id="tags"
        name="tags"
        label="Tags (comma-separated, optional)"
        placeholder="tips, shipping"
        defaultValue={initial?.tags}
        error={state.fieldErrors?.tags?.[0]}
      />
      <Input
        id="seoTitle"
        name="seoTitle"
        label="SEO title (optional)"
        defaultValue={initial?.seoTitle ?? undefined}
        error={state.fieldErrors?.seoTitle?.[0]}
      />
      <Input
        id="seoDescription"
        name="seoDescription"
        label="SEO description (optional)"
        defaultValue={initial?.seoDescription ?? undefined}
        error={state.fieldErrors?.seoDescription?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
