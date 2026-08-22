"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createExchangeRateAction, type CurrencyFormState } from "@/server/currency/actions";

export function ExchangeRateForm({ currencies }: { currencies: { code: string }[] }) {
  const [state, formAction, pending] = useActionState<CurrencyFormState, FormData>(
    createExchangeRateAction,
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fromCode" className="font-display text-sm font-semibold text-text-primary">
          From
        </label>
        <select
          id="fromCode"
          name="fromCode"
          required
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="toCode" className="font-display text-sm font-semibold text-text-primary">
          To
        </label>
        <select
          id="toCode"
          name="toCode"
          required
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      <Input
        id="rate"
        name="rate"
        type="number"
        step="0.00000001"
        min="0"
        label="Rate"
        hint="1 From = this many To"
        required
        className="w-40"
        error={state.fieldErrors?.rate?.[0]}
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
        Add rate
      </Button>
    </form>
  );
}
