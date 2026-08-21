"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { CouponFormState } from "@/server/coupons/actions";

export function CouponForm({
  action,
}: {
  action: (state: CouponFormState, formData: FormData) => Promise<CouponFormState>;
}) {
  const [state, formAction, pending] = useActionState<CouponFormState, FormData>(action, {});

  if (state.success) {
    return <Alert variant="success">Coupon created.</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input id="code" name="code" label="Code" required error={state.fieldErrors?.code?.[0]} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="font-display text-sm font-semibold text-text-primary">
          Type
        </label>
        <select
          id="type"
          name="type"
          defaultValue="PERCENTAGE"
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="PERCENTAGE">Percentage off</option>
          <option value="FIXED_AMOUNT">Fixed amount off</option>
          <option value="FREE_SHIPPING">Free shipping</option>
        </select>
      </div>
      <Input
        id="value"
        name="value"
        type="number"
        step="0.01"
        min={0}
        label="Value (% or amount — ignored for free shipping)"
        error={state.fieldErrors?.value?.[0]}
      />
      <Input id="minOrderTotal" name="minOrderTotal" type="number" step="0.01" min={0} label="Minimum order total (optional)" />
      <Input id="maxDiscount" name="maxDiscount" type="number" step="0.01" min={0} label="Maximum discount (optional)" />
      <Input id="usageLimit" name="usageLimit" type="number" min={1} label="Total usage limit (optional)" />
      <Input id="usageLimitPerUser" name="usageLimitPerUser" type="number" min={1} label="Per-customer usage limit (optional)" />
      <Input id="startsAt" name="startsAt" type="date" label="Starts (optional)" />
      <Input id="endsAt" name="endsAt" type="date" label="Ends (optional)" />
      <Button type="submit" variant="primary" loading={pending}>
        Create coupon
      </Button>
    </form>
  );
}
