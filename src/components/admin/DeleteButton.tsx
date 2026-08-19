"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

interface DeleteState {
  error?: string;
  success?: boolean;
}

type DeleteAction = (
  state: DeleteState,
  formData: FormData,
) => Promise<DeleteState>;

export function DeleteButton({
  action,
  confirmMessage,
  label = "Delete",
}: {
  action: DeleteAction;
  confirmMessage: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {label}
      </Button>
      {state.error ? (
        <p className="text-xs text-danger">{state.error}</p>
      ) : null}
    </form>
  );
}
