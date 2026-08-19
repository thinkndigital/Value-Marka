"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { requestReturnAction, type OrderActionFormState } from "@/server/orders/customer-actions";

export function ReturnRequestForm({
  orderNumber,
  sellerOrderId,
}: {
  orderNumber: string;
  sellerOrderId: string;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = requestReturnAction.bind(null, orderNumber, sellerOrderId);
  const [state, formAction, pending] = useActionState<OrderActionFormState, FormData>(boundAction, {});

  if (state.success) {
    return <Alert variant="success">Return requested — the seller will review it.</Alert>;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Request return
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <textarea
        name="reason"
        placeholder="Why are you returning this item?"
        rows={2}
        required
        className="vm-focus-ring rounded-md border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary"
      />
      {state.fieldErrors?.reason?.[0] ? (
        <p className="text-sm text-danger">{state.fieldErrors.reason[0]}</p>
      ) : null}
      <Button type="submit" variant="primary" size="sm" loading={pending} className="self-start">
        Submit return request
      </Button>
    </form>
  );
}
