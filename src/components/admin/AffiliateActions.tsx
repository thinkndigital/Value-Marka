"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { AffiliateFormState } from "@/server/affiliates/actions";

type AffiliateAction = (
  state: AffiliateFormState,
  formData: FormData,
) => Promise<AffiliateFormState>;

export function AffiliateActions({
  status,
  approveAction,
  suspendAction,
}: {
  status: "PENDING" | "APPROVED" | "SUSPENDED";
  approveAction: AffiliateAction;
  suspendAction: AffiliateAction;
}) {
  const [approveState, approveFormAction, approvePending] = useActionState<
    AffiliateFormState,
    FormData
  >(approveAction, {});
  const [suspendState, suspendFormAction, suspendPending] = useActionState<
    AffiliateFormState,
    FormData
  >(suspendAction, {});

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "APPROVED" ? (
          <form action={approveFormAction}>
            <Button type="submit" variant="outline" size="sm" loading={approvePending}>
              Approve
            </Button>
          </form>
        ) : null}
        {status !== "SUSPENDED" ? (
          <form action={suspendFormAction}>
            <Button type="submit" variant="ghost" size="sm" loading={suspendPending}>
              Suspend
            </Button>
          </form>
        ) : null}
      </div>
      {approveState.error ? <p className="text-xs text-danger">{approveState.error}</p> : null}
      {suspendState.error ? <p className="text-xs text-danger">{suspendState.error}</p> : null}
    </div>
  );
}
