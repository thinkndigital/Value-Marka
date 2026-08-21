"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { AffiliateFormState } from "@/server/affiliates/actions";
import { applyToBeAffiliateAction } from "@/server/affiliates/actions";

export function ApplyAffiliateForm() {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(
    applyToBeAffiliateAction,
    {},
  );

  if (state.success) {
    return <Alert variant="success">Application submitted — we&apos;ll review it shortly.</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Button type="submit" variant="primary" loading={pending}>
        Apply now
      </Button>
    </form>
  );
}
