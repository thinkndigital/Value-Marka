"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  createWarehouseAction,
  type WarehouseFormState,
} from "@/server/warehouses/actions";

export function WarehouseForm({
  countries,
}: {
  countries: { code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<WarehouseFormState, FormData>(
    createWarehouseAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="name"
        name="name"
        label="Warehouse name"
        required
        error={state.fieldErrors?.name?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="countryCode" className="font-display text-sm font-semibold text-text-primary">
          Country
        </label>
        <select
          id="countryCode"
          name="countryCode"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a country
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.countryCode?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.countryCode[0]}</p>
        ) : null}
      </div>
      <Input id="city" name="city" label="City" required error={state.fieldErrors?.city?.[0]} />
      <Input id="addressLine" name="addressLine" label="Address (optional)" />
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="isDefault" className="vm-focus-ring" />
        Make this my default warehouse
      </label>
      <Button type="submit" variant="primary" loading={pending}>
        Add warehouse
      </Button>
    </form>
  );
}
