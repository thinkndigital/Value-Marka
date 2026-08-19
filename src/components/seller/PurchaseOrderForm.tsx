"use client";

import { useActionState, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  createPurchaseOrderAction,
  type PurchaseOrderFormState,
} from "@/server/purchaseOrders/actions";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
  currencyCode: string;
}

interface Line {
  productId: string;
  quantityOrdered: number;
  unitCost: number;
}

export function PurchaseOrderForm({
  suppliers,
  warehouses,
  products,
  currencies,
}: {
  suppliers: { id: string; companyName: string }[];
  warehouses: { id: string; name: string }[];
  products: ProductOption[];
  currencies: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [state, formAction, pending] = useActionState<PurchaseOrderFormState, FormData>(
    async (prevState, formData) => {
      formData.set("itemsJson", JSON.stringify(lines));
      const result = await createPurchaseOrderAction(prevState, formData);
      if (result.success && result.purchaseOrderId) {
        router.push(`/seller/purchase-orders/${result.purchaseOrderId}`);
      }
      return result;
    },
    {},
  );

  function addLine() {
    if (products.length === 0) return;
    const first = products[0];
    setLines((prev) => [
      ...prev,
      { productId: first.id, quantityOrdered: 1, unitCost: Number(first.costPrice) },
    ]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.fieldErrors?.items?.[0] ? <Alert variant="danger">{state.fieldErrors.items[0]}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplierId" className="font-display text-sm font-semibold text-text-primary">
            Supplier
          </label>
          <select
            id="supplierId"
            name="supplierId"
            required
            defaultValue=""
            className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
          >
            <option value="" disabled>
              Select a supplier
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName}
              </option>
            ))}
          </select>
          {state.fieldErrors?.supplierId?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.supplierId[0]}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="warehouseId" className="font-display text-sm font-semibold text-text-primary">
            Receiving warehouse
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

        <Input id="expectedAt" name="expectedAt" type="date" label="Expected delivery (optional)" />
        <Input id="tax" name="tax" type="number" step="0.01" min={0} label="Tax (optional)" defaultValue="0" />
        <Input
          id="shipping"
          name="shipping"
          type="number"
          step="0.01"
          min={0}
          label="Shipping (optional)"
          defaultValue="0"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-text-primary">Line items</h3>
          <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={products.length === 0}>
            Add line
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-text-muted">No lines yet — add at least one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((line, index) => (
              <div key={index} className="flex items-center gap-2 rounded-md border border-border-default p-2">
                <select
                  value={line.productId}
                  onChange={(e) => updateLine(index, { productId: e.target.value })}
                  className="vm-focus-ring h-9 flex-1 rounded-md border border-border-default bg-bg-page px-2 text-sm text-text-primary"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.quantityOrdered}
                  onChange={(e) => updateLine(index, { quantityOrdered: Number(e.target.value) })}
                  className="vm-focus-ring h-9 w-20 rounded-md border border-border-default bg-bg-page px-2 text-sm text-text-primary"
                  aria-label="Quantity"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) => updateLine(index, { unitCost: Number(e.target.value) })}
                  className="vm-focus-ring h-9 w-24 rounded-md border border-border-default bg-bg-page px-2 text-sm text-text-primary"
                  aria-label="Unit cost"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-end font-display text-sm font-bold text-text-primary">
          Subtotal: {total.toFixed(2)}
        </p>
      </div>

      <Button type="submit" variant="primary" loading={pending} disabled={lines.length === 0}>
        Create purchase order
      </Button>
    </form>
  );
}
