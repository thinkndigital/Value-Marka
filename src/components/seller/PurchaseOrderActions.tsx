"use client";

import { useActionState } from "react";
import type { PurchaseOrderStatus, PaymentStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  submitPurchaseOrderAction,
  cancelPurchaseOrderAction,
  markPurchaseOrderPaidAction,
  type PurchaseOrderFormState,
} from "@/server/purchaseOrders/actions";

function ActionButton({
  action,
  label,
  variant = "primary",
}: {
  action: (state: PurchaseOrderFormState, formData: FormData) => Promise<PurchaseOrderFormState>;
  label: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const [state, formAction, pending] = useActionState<PurchaseOrderFormState, FormData>(action, {});
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <Button type="submit" variant={variant} size="sm" loading={pending}>
        {label}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function PurchaseOrderActions({
  purchaseOrderId,
  status,
  paymentStatus,
}: {
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const submit = submitPurchaseOrderAction.bind(null, purchaseOrderId);
  const cancel = cancelPurchaseOrderAction.bind(null, purchaseOrderId);
  const markPaid = markPurchaseOrderPaidAction.bind(null, purchaseOrderId);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" ? <ActionButton action={submit} label="Submit to supplier" /> : null}
      {["DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED"].includes(status) ? (
        <ActionButton action={cancel} label="Cancel" variant="outline" />
      ) : null}
      {paymentStatus !== "PAID" ? (
        <ActionButton action={markPaid} label="Mark paid" variant="outline" />
      ) : null}
    </div>
  );
}
