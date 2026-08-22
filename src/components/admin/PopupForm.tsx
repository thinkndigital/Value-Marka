"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CmsFormState } from "@/server/cms/actions";

type PopupAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

interface PopupInitial {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  imageUrl?: string;
  ctaLabelEn?: string;
  ctaLabelAr?: string;
  ctaHref?: string;
  target: "ALL" | "GUEST" | "CUSTOMER";
  startDate?: string;
  endDate?: string;
}

export function PopupForm({
  action,
  initial,
  submitLabel = "Add popup",
}: {
  action: PopupAction;
  initial?: PopupInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="titleEn"
          name="titleEn"
          label="English title"
          defaultValue={initial?.titleEn}
          error={state.fieldErrors?.titleEn?.[0]}
        />
        <Input
          id="titleAr"
          name="titleAr"
          label="Arabic title"
          dir="rtl"
          defaultValue={initial?.titleAr}
          error={state.fieldErrors?.titleAr?.[0]}
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
            rows={3}
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
            rows={3}
            dir="rtl"
            defaultValue={initial?.bodyAr}
            className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2 text-sm text-text-primary"
          />
          {state.fieldErrors?.bodyAr?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.bodyAr[0]}</p>
          ) : null}
        </div>
      </div>
      <Input
        id="imageUrl"
        name="imageUrl"
        label="Image URL (optional)"
        defaultValue={initial?.imageUrl}
        error={state.fieldErrors?.imageUrl?.[0]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="ctaLabelEn"
          name="ctaLabelEn"
          label="CTA label — English (optional)"
          defaultValue={initial?.ctaLabelEn}
          error={state.fieldErrors?.ctaLabelEn?.[0]}
        />
        <Input
          id="ctaLabelAr"
          name="ctaLabelAr"
          label="CTA label — Arabic (optional)"
          dir="rtl"
          defaultValue={initial?.ctaLabelAr}
          error={state.fieldErrors?.ctaLabelAr?.[0]}
        />
      </div>
      <Input
        id="ctaHref"
        name="ctaHref"
        label="CTA link (optional)"
        placeholder="/search"
        defaultValue={initial?.ctaHref}
        error={state.fieldErrors?.ctaHref?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="target" className="font-display text-sm font-semibold text-text-primary">
          Audience
        </label>
        <select
          id="target"
          name="target"
          required
          defaultValue={initial?.target ?? "ALL"}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="ALL">Everyone</option>
          <option value="GUEST">Signed-out visitors only</option>
          <option value="CUSTOMER">Signed-in customers only</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="startDate"
          name="startDate"
          type="date"
          label="Start date (optional)"
          defaultValue={initial?.startDate}
          error={state.fieldErrors?.startDate?.[0]}
        />
        <Input
          id="endDate"
          name="endDate"
          type="date"
          label="End date (optional)"
          defaultValue={initial?.endDate}
          error={state.fieldErrors?.endDate?.[0]}
        />
      </div>
      <Button type="submit" variant="primary" size="sm" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
