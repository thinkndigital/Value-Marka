"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cancelOrderAction, type OrderActionFormState } from "@/server/orders/customer-actions";

export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const boundAction = cancelOrderAction.bind(null, orderNumber);
  const [state, formAction, pending] = useActionState<OrderActionFormState, FormData>(boundAction, {});

  if (state.success) {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Cancel this order?")) event.preventDefault();
      }}
    >
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Cancel order
      </Button>
    </form>
  );
}
