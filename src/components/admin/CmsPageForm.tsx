"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { CmsFormState } from "@/server/cms/actions";

type PageAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

export function CmsPageForm({
  action,
  initial,
  showSlug = false,
  submitLabel = "Save page",
}: {
  action: PageAction;
  initial?: { slug?: string; seoTitle?: string; seoDescription?: string; body: string };
  showSlug?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success && showSlug) {
      router.push("/admin/cms/pages");
    }
  }, [state.success, showSlug, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Page saved.</Alert> : null}
      {showSlug ? (
        <Input
          id="slug"
          name="slug"
          label="Slug"
          required
          hint="Lowercase letters, numbers, and hyphens only. Used at /page/[slug]."
          defaultValue={initial?.slug}
          error={state.fieldErrors?.slug?.[0]}
        />
      ) : null}
      <Input
        id="seoTitle"
        name="seoTitle"
        label="SEO title (optional)"
        defaultValue={initial?.seoTitle}
        error={state.fieldErrors?.seoTitle?.[0]}
      />
      <Input
        id="seoDescription"
        name="seoDescription"
        label="SEO description (optional)"
        defaultValue={initial?.seoDescription}
        error={state.fieldErrors?.seoDescription?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="font-display text-sm font-semibold text-text-primary">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={12}
          required
          defaultValue={initial?.body}
          className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
        />
        {state.fieldErrors?.body?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.body[0]}</p>
        ) : (
          <p className="text-sm text-text-muted">Plain text — line breaks become paragraphs.</p>
        )}
      </div>
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
