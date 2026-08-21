"use client";

import { useActionState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";

interface ActionState {
  error?: string;
  success?: boolean;
}

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function FormActionButton({
  action,
  label,
  variant = "outline",
}: {
  action: FormAction;
  label: string;
  variant?: ButtonVariant;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <Button type="submit" variant={variant} size="sm" loading={pending}>
        {label}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
