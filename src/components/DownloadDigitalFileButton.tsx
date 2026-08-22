"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { requestDigitalDownloadAction, type DownloadFormState } from "@/server/digitalProducts/actions";

export function DownloadDigitalFileButton({ orderItemId }: { orderItemId: string }) {
  const boundAction = requestDigitalDownloadAction.bind(null, orderItemId);
  const [state, formAction, pending] = useActionState<DownloadFormState, FormData>(boundAction, {});

  useEffect(() => {
    if (state.url) {
      window.location.href = state.url;
    }
  }, [state.url]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Download
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
