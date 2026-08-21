"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CmsFormState } from "@/server/cms/actions";

type HeroAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

export function HeroForm({
  action,
  initial,
}: {
  action: HeroAction;
  initial: {
    kicker: string;
    title: string;
    subtitle: string;
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
  };
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Hero content saved.</Alert> : null}
      <Input id="kicker" name="kicker" label="Kicker" defaultValue={initial.kicker} error={state.fieldErrors?.kicker?.[0]} />
      <Input id="title" name="title" label="Title" defaultValue={initial.title} error={state.fieldErrors?.title?.[0]} />
      <Input
        id="subtitle"
        name="subtitle"
        label="Subtitle"
        defaultValue={initial.subtitle}
        error={state.fieldErrors?.subtitle?.[0]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="ctaPrimaryLabel"
          name="ctaPrimaryLabel"
          label="Primary CTA label"
          defaultValue={initial.ctaPrimaryLabel}
          error={state.fieldErrors?.ctaPrimaryLabel?.[0]}
        />
        <Input
          id="ctaPrimaryHref"
          name="ctaPrimaryHref"
          label="Primary CTA link"
          defaultValue={initial.ctaPrimaryHref}
          error={state.fieldErrors?.ctaPrimaryHref?.[0]}
        />
        <Input
          id="ctaSecondaryLabel"
          name="ctaSecondaryLabel"
          label="Secondary CTA label"
          defaultValue={initial.ctaSecondaryLabel}
          error={state.fieldErrors?.ctaSecondaryLabel?.[0]}
        />
        <Input
          id="ctaSecondaryHref"
          name="ctaSecondaryHref"
          label="Secondary CTA link"
          defaultValue={initial.ctaSecondaryHref}
          error={state.fieldErrors?.ctaSecondaryHref?.[0]}
        />
      </div>
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        Save hero
      </Button>
    </form>
  );
}
