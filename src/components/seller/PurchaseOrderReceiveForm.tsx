"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  receivePurchaseOrderAction,
  type PurchaseOrderFormState,
} from "@/server/purchaseOrders/actions";

interface Item {
  id: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
}

export function PurchaseOrderReceiveForm({
  purchaseOrderId,
  items,
}: {
  purchaseOrderId: string;
  items: Item[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(items.map((item) => [item.id, item.quantityOrdered - item.quantityReceived])),
  );
  const boundAction = receivePurchaseOrderAction.bind(null, purchaseOrderId);
  const [state, formAction, pending] = useActionState<PurchaseOrderFormState, FormData>(
    async (prevState, formData) => {
      const receipts = items
        .filter((item) => item.quantityOrdered - item.quantityReceived > 0)
        .map((item) => ({ itemId: item.id, quantityReceived: quantities[item.id] ?? 0 }));
      formData.set("receiptsJson", JSON.stringify(receipts));
      return boundAction(prevState, formData);
    },
    {},
  );

  const pendingItems = items.filter((item) => item.quantityOrdered - item.quantityReceived > 0);
  if (pendingItems.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
      <h3 className="font-display text-sm font-bold text-text-primary">Receive stock</h3>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {pendingItems.map((item) => {
        const remaining = item.quantityOrdered - item.quantityReceived;
        return (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-primary">
              {item.productName} ({remaining} remaining)
            </span>
            <input
              type="number"
              min={0}
              max={remaining}
              value={quantities[item.id] ?? 0}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
              }
              className="vm-focus-ring h-9 w-20 rounded-md border border-border-default bg-bg-page px-2 text-sm text-text-primary"
            />
          </div>
        );
      })}
      <Button type="submit" variant="primary" loading={pending} className="self-start">
        Confirm receipt
      </Button>
    </form>
  );
}
