"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EXPENSE_CATEGORIES } from "@/server/validation/expense";
import type { ExpenseFormState } from "@/server/expenses/actions";

export function ExpenseForm({
  currencies,
  action,
}: {
  currencies: { code: string; name: string }[];
  action: (state: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
}) {
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="font-display text-sm font-semibold text-text-primary">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a category
          </option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {state.fieldErrors?.category?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.category[0]}</p>
        ) : null}
      </div>
      <Input
        id="description"
        name="description"
        label="Description (optional)"
        error={state.fieldErrors?.description?.[0]}
      />
      <Input
        id="amount"
        name="amount"
        type="number"
        step="0.01"
        min={0.01}
        label="Amount"
        required
        error={state.fieldErrors?.amount?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currencyCode" className="font-display text-sm font-semibold text-text-primary">
          Currency
        </label>
        <select
          id="currencyCode"
          name="currencyCode"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a currency
          </option>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
      <Input id="incurredAt" name="incurredAt" type="date" label="Date (optional, defaults to today)" />
      <Button type="submit" variant="primary" loading={pending}>
        Add expense
      </Button>
    </form>
  );
}
