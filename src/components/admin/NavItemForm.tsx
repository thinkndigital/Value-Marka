"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { NavFormState } from "@/server/navigation/actions";

type NavAction = (state: NavFormState, formData: FormData) => Promise<NavFormState>;

export function NavItemForm({
  action,
  initial,
  submitLabel = "Add link",
}: {
  action: NavAction;
  initial?: { label: string; url: string };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<NavFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input
        id="label"
        name="label"
        label="Label"
        defaultValue={initial?.label}
        error={state.fieldErrors?.label?.[0]}
      />
      <Input
        id="url"
        name="url"
        label="URL"
        placeholder="/page/about-us"
        defaultValue={initial?.url}
        error={state.fieldErrors?.url?.[0]}
      />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        {submitLabel}
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
