"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CmsFormState } from "@/server/cms/actions";

type LimitAction = (state: CmsFormState, formData: FormData) => Promise<CmsFormState>;

export function LimitForm({
  action,
  label,
  initial,
}: {
  action: LimitAction;
  label: string;
  initial: number;
}) {
  const [state, formAction, pending] = useActionState<CmsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-end gap-2">
      <Input
        id={`limit-${label}`}
        name="limit"
        type="number"
        min={1}
        max={48}
        label={label}
        defaultValue={initial}
        error={state.fieldErrors?.limit?.[0]}
      />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Save
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
