"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { addToCartAction, type CartFormState } from "@/server/cart/actions";

export function AddToCartForm({
  productId,
  available,
}: {
  productId: string;
  available: number;
}) {
  const t = useTranslations("Product");
  const [state, formAction, pending] = useActionState<CartFormState, FormData>(
    addToCartAction,
    {},
  );

  if (available <= 0) {
    return <Alert variant="warning">{t("outOfStock")}</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{t("addedToCart")}</Alert> : null}
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-text-secondary">
          {t("quantity")}
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          max={Math.min(available, 99)}
          defaultValue={1}
          className="vm-focus-ring h-10 w-20 rounded-md border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? t("adding") : t("addToCart")}
      </Button>
    </form>
  );
}
