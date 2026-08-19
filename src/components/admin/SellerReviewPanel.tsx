"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { SellerFormState } from "@/server/sellers/actions";

type SellerAction = (
  state: SellerFormState,
  formData: FormData,
) => Promise<SellerFormState>;

export function SellerReviewPanel({
  approveAction,
  rejectAction,
}: {
  approveAction: SellerAction;
  rejectAction: SellerAction;
}) {
  const [approveState, approveFormAction, approvePending] = useActionState<
    SellerFormState,
    FormData
  >(approveAction, {});
  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    SellerFormState,
    FormData
  >(rejectAction, {});

  if (approveState.success) {
    return <Alert variant="success">Application approved. The seller can now sign in to their dashboard.</Alert>;
  }
  if (rejectState.success) {
    return <Alert variant="info">Application rejected.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      {approveState.error ? <Alert variant="danger">{approveState.error}</Alert> : null}
      {rejectState.error ? <Alert variant="danger">{rejectState.error}</Alert> : null}

      <form action={approveFormAction}>
        <Button type="submit" variant="primary" loading={approvePending}>
          Approve application
        </Button>
      </form>

      <form action={rejectFormAction} className="flex flex-col gap-2">
        <label htmlFor="reason" className="font-display text-sm font-semibold text-text-primary">
          Rejection reason
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
        />
        {rejectState.fieldErrors?.reason?.[0] ? (
          <p className="text-sm text-danger">{rejectState.fieldErrors.reason[0]}</p>
        ) : null}
        <Button type="submit" variant="danger" loading={rejectPending}>
          Reject application
        </Button>
      </form>
    </div>
  );
}
