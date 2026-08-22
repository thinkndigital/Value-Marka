"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createRewardRuleAction, type LoyaltyFormState } from "@/server/loyalty/actions";

export function RewardRuleForm() {
  const [state, formAction, pending] = useActionState<LoyaltyFormState, FormData>(
    createRewardRuleAction,
    {},
  );

  const now = new Date().toISOString().slice(0, 16);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error ? (
        <div className="w-full">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      ) : null}
      <Input
        id="pointsPerCurrencyUnit"
        name="pointsPerCurrencyUnit"
        type="number"
        step="0.01"
        min="0"
        label="Points earned per 1 unit spent"
        hint="e.g. 1 = 1 point per $1"
        required
        className="w-56"
        error={state.fieldErrors?.pointsPerCurrencyUnit?.[0]}
      />
      <Input
        id="redemptionValue"
        name="redemptionValue"
        type="number"
        step="0.0001"
        min="0"
        label="Currency value of 1 point"
        hint="e.g. 0.01 = 100 points = $1"
        required
        className="w-56"
        error={state.fieldErrors?.redemptionValue?.[0]}
      />
      <Input
        id="effectiveAt"
        name="effectiveAt"
        type="datetime-local"
        label="Effective from"
        required
        defaultValue={now}
        error={state.fieldErrors?.effectiveAt?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending}>
        Add rule
      </Button>
    </form>
  );
}
