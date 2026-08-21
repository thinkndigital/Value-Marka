"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CmsFormState } from "@/server/cms/actions";

type BannerAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

export function BannerForm({
  action,
  initial,
  submitLabel = "Add banner",
}: {
  action: BannerAction;
  initial?: { headline: string; subheadline?: string; imageUrl?: string; href: string };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="headline"
        name="headline"
        label="Headline"
        defaultValue={initial?.headline}
        error={state.fieldErrors?.headline?.[0]}
      />
      <Input
        id="subheadline"
        name="subheadline"
        label="Subheadline (optional)"
        defaultValue={initial?.subheadline}
        error={state.fieldErrors?.subheadline?.[0]}
      />
      <Input
        id="imageUrl"
        name="imageUrl"
        label="Image URL (optional)"
        defaultValue={initial?.imageUrl}
        error={state.fieldErrors?.imageUrl?.[0]}
      />
      <Input
        id="href"
        name="href"
        label="Link"
        placeholder="/search"
        defaultValue={initial?.href}
        error={state.fieldErrors?.href?.[0]}
      />
      <Button type="submit" variant="primary" size="sm" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
