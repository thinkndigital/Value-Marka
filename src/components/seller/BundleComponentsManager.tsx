"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DeleteButton } from "@/components/admin/DeleteButton";
import {
  addBundleComponentAction,
  removeBundleComponentAction,
  type BundleFormState,
} from "@/server/bundles/actions";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: string;
  currencyCode: string;
}

interface ComponentRow {
  id: string;
  quantity: number;
  componentProduct: { id: string; name: string; sku: string };
}

export function BundleComponentsManager({
  bundleProductId,
  components,
  availableProducts,
  availableStock,
}: {
  bundleProductId: string;
  components: ComponentRow[];
  availableProducts: ProductOption[];
  availableStock: number;
}) {
  const boundAdd = addBundleComponentAction.bind(null, bundleProductId);
  const [state, formAction, pending] = useActionState<BundleFormState, FormData>(boundAdd, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const remainingProducts = availableProducts.filter(
    (p) => !components.some((c) => c.componentProduct.id === p.id),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Sellable as a bundle: <strong>{availableStock}</strong> (the lowest, real available stock
        across all components — never a fixed or cached number).
      </p>

      {components.length === 0 ? (
        <p className="text-sm text-text-muted">No components yet — add at least one below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {components.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border border-border-default p-3 text-sm"
            >
              <span className="text-text-primary">
                {c.componentProduct.name}{" "}
                <span className="text-text-muted">({c.componentProduct.sku})</span> × {c.quantity}
              </span>
              <DeleteButton
                action={removeBundleComponentAction.bind(null, c.id, bundleProductId)}
                confirmMessage={`Remove "${c.componentProduct.name}" from this bundle?`}
                label="Remove"
              />
            </div>
          ))}
        </div>
      )}

      {remainingProducts.length === 0 ? (
        <p className="text-sm text-text-muted">
          {availableProducts.length === 0
            ? "You have no simple (physical) products yet to add as components."
            : "Every one of your simple products is already in this bundle."}
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          {state.error ? (
            <div className="w-full">
              <Alert variant="danger">{state.error}</Alert>
            </div>
          ) : null}
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label
              htmlFor="componentProductId"
              className="font-display text-sm font-semibold text-text-primary"
            >
              Component product
            </label>
            <select
              id="componentProductId"
              name="componentProductId"
              required
              defaultValue=""
              className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
            >
              <option value="" disabled>
                Select a product
              </option>
              {remainingProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.sku} — {p.currencyCode} {p.price}
                </option>
              ))}
            </select>
            {state.fieldErrors?.componentProductId?.[0] ? (
              <p className="text-sm text-danger">{state.fieldErrors.componentProductId[0]}</p>
            ) : null}
          </div>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            step="1"
            label="Quantity"
            defaultValue={1}
            required
            className="w-28"
            error={state.fieldErrors?.quantity?.[0]}
          />
          <Button type="submit" variant="primary" loading={pending}>
            Add component
          </Button>
        </form>
      )}
    </div>
  );
}
