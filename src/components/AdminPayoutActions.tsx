"use client";

import { useActionState } from "react";
import type { PayoutStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  approvePayoutAction,
  holdPayoutAction,
  rejectPayoutAction,
  releasePayoutAction,
  type PayoutActionState,
} from "@/server/payouts/admin-actions";

function ActionButton({
  action,
  label,
  variant = "primary",
}: {
  action: (state: PayoutActionState, formData: FormData) => Promise<PayoutActionState>;
  label: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const [state, formAction, pending] = useActionState<PayoutActionState, FormData>(action, {});
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <Button type="submit" variant={variant} size="sm" loading={pending}>
        {label}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function AdminPayoutActions({ payoutId, status }: { payoutId: string; status: PayoutStatus }) {
  const approve = approvePayoutAction.bind(null, payoutId);
  const hold = holdPayoutAction.bind(null, payoutId);
  const reject = rejectPayoutAction.bind(null, payoutId);
  const release = releasePayoutAction.bind(null, payoutId);

  if (status === "PENDING") {
    return (
      <div className="flex gap-2">
        <ActionButton action={approve} label="Approve" />
        <ActionButton action={hold} label="Hold" variant="outline" />
        <ActionButton action={reject} label="Reject" variant="danger" />
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="flex gap-2">
        <ActionButton action={release} label="Release" />
        <ActionButton action={hold} label="Hold" variant="outline" />
      </div>
    );
  }

  if (status === "ON_HOLD") {
    return (
      <div className="flex gap-2">
        <ActionButton action={approve} label="Approve" />
        <ActionButton action={reject} label="Reject" variant="danger" />
      </div>
    );
  }

  return null;
}
