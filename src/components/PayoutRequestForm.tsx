"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { requestPayoutAction, type PayoutFormState } from "@/server/payouts/seller-actions";

export function PayoutRequestForm({
  currencyCode,
  available,
}: {
  currencyCode: string;
  available: number;
}) {
  const boundAction = requestPayoutAction.bind(null, currencyCode);
  const [state, formAction, pending] = useActionState<PayoutFormState, FormData>(boundAction, {});

  if (state.success) {
    return <Alert variant="success">Payout requested — an admin will review it.</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-text-primary">{currencyCode} balance</p>
        <p className="font-display text-lg font-bold text-text-primary">
          {currencyCode} {available.toFixed(2)}
        </p>
      </div>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id={`amount-${currencyCode}`}
        name="amount"
        type="number"
        step="0.01"
        min={0.01}
        max={available}
        label="Amount"
        required
        error={state.fieldErrors?.amount?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label className="font-display text-sm font-semibold text-text-primary">Payout method</label>
        <select
          name="method"
          defaultValue="STRIPE"
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-page px-3.5 text-sm text-text-primary"
        >
          <option value="STRIPE">Stripe</option>
          <option value="PAYPAL">PayPal</option>
        </select>
        {state.fieldErrors?.method?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.method[0]}</p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" loading={pending} disabled={available <= 0}>
        Request payout
      </Button>
    </form>
  );
}
