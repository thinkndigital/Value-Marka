"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { adjustStockAction, type ProductFormState } from "@/server/products/actions";

export function StockAdjustmentForm({
  productId,
  warehouses,
}: {
  productId: string;
  warehouses: { id: string; name: string }[];
}) {
  const action = adjustStockAction.bind(null, productId);
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Stock updated.</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="warehouseId" className="font-display text-sm font-semibold text-text-primary">
          Warehouse
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
        {state.fieldErrors?.warehouseId?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.warehouseId[0]}</p>
        ) : null}
      </div>
      <Input
        id="delta"
        name="delta"
        type="number"
        label="Adjustment"
        hint="Positive to add stock, negative to remove it."
        required
        error={state.fieldErrors?.delta?.[0]}
      />
      <Input
        id="reason"
        name="reason"
        label="Reason"
        required
        error={state.fieldErrors?.reason?.[0]}
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Apply adjustment
      </Button>
    </form>
  );
}
