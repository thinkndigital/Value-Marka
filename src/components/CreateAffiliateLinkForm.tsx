"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { AffiliateFormState } from "@/server/affiliates/actions";
import { createAffiliateLinkAction } from "@/server/affiliates/actions";

export function CreateAffiliateLinkForm() {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(
    createAffiliateLinkAction,
    {},
  );

  return (
    <div className="flex flex-col gap-2">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <form action={formAction} className="flex items-end gap-2">
        <Input
          id="targetUrl"
          name="targetUrl"
          label="Page to link to"
          placeholder="/search"
          className="flex-1"
        />
        <Button type="submit" variant="secondary" loading={pending}>
          Create link
        </Button>
      </form>
    </div>
  );
}
