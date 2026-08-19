"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { setProductStatusAction, type ProductFormState } from "@/server/products/actions";

export function StatusToggleButton({
  productId,
  status,
}: {
  productId: string;
  status: "ACTIVE" | "ARCHIVED";
}) {
  const nextStatus = status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
  const action = setProductStatusAction.bind(null, productId, nextStatus);
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {status === "ACTIVE" ? "Archive" : "Reactivate"}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
