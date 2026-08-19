"use client";

import { useActionState } from "react";
import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import {
  confirmOrderAction,
  startProcessingAction,
  markPackedAction,
  shipOrderAction,
  markOutForDeliveryAction,
  markDeliveredAction,
  cancelSellerOrderAction,
  approveReturnAction,
  rejectReturnAction,
  markRefundedAction,
  type SellerOrderFormState,
} from "@/server/orders/seller-actions";

function ActionButton({
  action,
  label,
  variant = "primary",
}: {
  action: (state: SellerOrderFormState, formData: FormData) => Promise<SellerOrderFormState>;
  label: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const [state, formAction, pending] = useActionState<SellerOrderFormState, FormData>(action, {});
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <Button type="submit" variant={variant} size="sm" loading={pending}>
        {label}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

function ShipForm({ sellerOrderId }: { sellerOrderId: string }) {
  const boundAction = shipOrderAction.bind(null, sellerOrderId);
  const [state, formAction, pending] = useActionState<SellerOrderFormState, FormData>(boundAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
      <h3 className="font-display text-sm font-bold text-text-primary">Ship this order</h3>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input id="carrier" name="carrier" label="Carrier" required error={state.fieldErrors?.carrier?.[0]} />
      <Input
        id="trackingNumber"
        name="trackingNumber"
        label="Tracking number"
        required
        error={state.fieldErrors?.trackingNumber?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        Mark shipped
      </Button>
    </form>
  );
}

export function SellerOrderActions({ sellerOrderId, status }: { sellerOrderId: string; status: OrderStatus }) {
  const confirm = confirmOrderAction.bind(null, sellerOrderId);
  const startProcessing = startProcessingAction.bind(null, sellerOrderId);
  const markPacked = markPackedAction.bind(null, sellerOrderId);
  const markOutForDelivery = markOutForDeliveryAction.bind(null, sellerOrderId);
  const markDelivered = markDeliveredAction.bind(null, sellerOrderId);
  const cancel = cancelSellerOrderAction.bind(null, sellerOrderId);
  const approveReturn = approveReturnAction.bind(null, sellerOrderId);
  const rejectReturn = rejectReturnAction.bind(null, sellerOrderId);
  const markRefunded = markRefundedAction.bind(null, sellerOrderId);

  switch (status) {
    case "PENDING":
      return (
        <div className="flex flex-wrap gap-2">
          <ActionButton action={confirm} label="Confirm order" />
          <ActionButton action={cancel} label="Cancel" variant="outline" />
        </div>
      );
    case "CONFIRMED":
      return (
        <div className="flex flex-wrap gap-2">
          <ActionButton action={startProcessing} label="Start processing" />
          <ActionButton action={cancel} label="Cancel" variant="outline" />
        </div>
      );
    case "PROCESSING":
      return (
        <div className="flex flex-wrap gap-2">
          <ActionButton action={markPacked} label="Mark packed" />
          <ActionButton action={cancel} label="Cancel" variant="outline" />
        </div>
      );
    case "PACKED":
      return (
        <div className="flex flex-col gap-3">
          <ShipForm sellerOrderId={sellerOrderId} />
          <ActionButton action={cancel} label="Cancel" variant="outline" />
        </div>
      );
    case "SHIPPED":
      return <ActionButton action={markOutForDelivery} label="Mark out for delivery" />;
    case "OUT_FOR_DELIVERY":
      return <ActionButton action={markDelivered} label="Mark delivered" />;
    case "RETURN_REQUESTED":
      return (
        <div className="flex flex-wrap gap-2">
          <ActionButton action={approveReturn} label="Approve return" />
          <ActionButton action={rejectReturn} label="Reject return" variant="outline" />
        </div>
      );
    case "RETURNED":
      return <ActionButton action={markRefunded} label="Mark refunded" />;
    default:
      return null;
  }
}
