"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { FlashSaleFormState } from "@/server/flashSales/actions";

type FlashSaleAction = (state: FlashSaleFormState, formData: FormData) => Promise<FlashSaleFormState>;

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: string;
  currencyCode: string;
  sellerName: string;
}

export function FlashSaleItemForm({
  action,
  products,
}: {
  action: FlashSaleAction;
  products: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState<FlashSaleFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error ? (
        <div className="w-full">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      ) : null}
      <div className="flex flex-1 min-w-[220px] flex-col gap-1.5">
        <label htmlFor="productId" className="font-display text-sm font-semibold text-text-primary">
          Product
        </label>
        <select
          id="productId"
          name="productId"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a product
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.sku} — {p.currencyCode} {p.price} ({p.sellerName})
            </option>
          ))}
        </select>
        {state.fieldErrors?.productId?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.productId[0]}</p>
        ) : null}
      </div>
      <Input
        id="discountPercent"
        name="discountPercent"
        type="number"
        step="1"
        min="1"
        max="90"
        label="Discount (%)"
        required
        className="w-32"
        error={state.fieldErrors?.discountPercent?.[0]}
      />
      <Input
        id="stockLimit"
        name="stockLimit"
        type="number"
        step="1"
        min="1"
        label="Stock limit"
        hint="Optional"
        className="w-32"
        error={state.fieldErrors?.stockLimit?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending}>
        Add to sale
      </Button>
    </form>
  );
}
