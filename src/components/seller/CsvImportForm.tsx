"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  importProductsCsvAction,
  type CsvImportFormState,
} from "@/server/products/csv-actions";

export function CsvImportForm({
  warehouses,
}: {
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<CsvImportFormState, FormData>(
    importProductsCsvAction,
    {},
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.result ? (
        <Alert variant={state.result.errors.length > 0 ? "warning" : "success"}>
          {state.result.created} created, {state.result.updated} updated
          {state.result.errors.length > 0 ? `, ${state.result.errors.length} failed` : ""}.
        </Alert>
      ) : null}
      {state.result?.errors.length ? (
        <ul className="flex flex-col gap-1 rounded-md border border-border-default bg-bg-sunken p-3 text-xs text-text-secondary">
          {state.result.errors.slice(0, 20).map((e) => (
            <li key={e.row}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="warehouseId" className="font-display text-sm font-semibold text-text-primary">
          Warehouse for new products
        </label>
        <select
          id="warehouseId"
          name="warehouseId"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a warehouse
          </option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <input
        id="file"
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
        className="vm-focus-ring text-sm"
      />
      <p className="text-xs text-text-muted">
        Columns: sku, name, slug, categorySlug, brandSlug, price, costPrice,
        currencyCode, weightGrams, shortDescription, stock. Matching an
        existing SKU updates that product.
      </p>
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        Import CSV
      </Button>
    </form>
  );
}
