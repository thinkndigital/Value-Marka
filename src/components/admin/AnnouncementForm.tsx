"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CmsFormState } from "@/server/cms/actions";

type AnnouncementAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

export function AnnouncementForm({
  action,
  initial,
  submitLabel = "Add announcement",
}: {
  action: AnnouncementAction;
  initial?: { textEn: string; textAr: string; link?: string; startDate?: string; endDate?: string };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="textEn"
        name="textEn"
        label="English text"
        defaultValue={initial?.textEn}
        error={state.fieldErrors?.textEn?.[0]}
      />
      <Input
        id="textAr"
        name="textAr"
        label="Arabic text"
        dir="rtl"
        defaultValue={initial?.textAr}
        error={state.fieldErrors?.textAr?.[0]}
      />
      <Input
        id="link"
        name="link"
        label="Link (optional)"
        placeholder="/search"
        defaultValue={initial?.link}
        error={state.fieldErrors?.link?.[0]}
      />
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
