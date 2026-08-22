"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { TestConnectionState } from "@/server/integrations/actions";

type TestConnectionAction = (
  state: TestConnectionState,
  formData: FormData,
) => Promise<TestConnectionState>;

export function TestConnectionButton({ action }: { action: TestConnectionAction }) {
  const [state, formAction, pending] = useActionState<TestConnectionState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Test connection
      </Button>
      {state.error ? <p className="max-w-xs text-end text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="max-w-xs text-end text-xs text-success">{state.detail}</p> : null}
    </form>
  );
}
