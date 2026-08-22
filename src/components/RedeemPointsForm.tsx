"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { redeemPointsAction, type LoyaltyFormState } from "@/server/loyalty/actions";

export function RedeemPointsForm({ balance }: { balance: number }) {
  const [state, formAction, pending] = useActionState<LoyaltyFormState, FormData>(
    redeemPointsAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.couponCode ? (
        <Alert variant="success">
          Redeemed! Use code <strong>{state.couponCode}</strong> at checkout.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Input
          id="points"
          name="points"
          type="number"
          step="1"
          min="100"
          max={balance}
          label="Points to redeem"
          hint={`Balance: ${balance}`}
          required
          className="w-40"
          error={state.fieldErrors?.points?.[0]}
        />
        <Button type="submit" variant="primary" loading={pending} disabled={balance < 100}>
          Redeem for a coupon
        </Button>
      </div>
    </form>
  );
}
