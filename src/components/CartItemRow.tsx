"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  updateCartItemAction,
  removeCartItemAction,
  type CartFormState,
} from "@/server/cart/actions";

interface CartItemRowProps {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  sellerName: string;
  currencyCode: string;
  price: string;
  /** Set only when a flash sale discounts this item — the pre-discount price. */
  originalPrice?: string;
  quantity: number;
  lineTotal: string;
}

export function CartItemRow({
  id,
  slug,
  name,
  imageUrl,
  sellerName,
  currencyCode,
  price,
  originalPrice,
  quantity,
  lineTotal,
}: CartItemRowProps) {
  const t = useTranslations("Cart");
  const boundUpdate = updateCartItemAction.bind(null, id);
  const boundRemove = removeCartItemAction.bind(null, id);
  const [, updateAction, updatePending] = useActionState<CartFormState, FormData>(
    (state, formData) => boundUpdate(Number(formData.get("quantity")), state, formData),
    {},
  );
  const [, removeAction, removePending] = useActionState<CartFormState, FormData>(
    boundRemove,
    {},
  );

  return (
    <div className="flex items-center gap-4 border-b border-border-default py-4 last:border-0">
      <Link href={`/product/${slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-bg-sunken">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/product/${slug}`} className="font-medium text-text-primary hover:underline">
          {name}
        </Link>
        <p className="text-xs text-text-muted">{sellerName}</p>
        {originalPrice ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-danger">
              {currencyCode} {price}
            </span>
            <span className="text-text-muted line-through">
              {currencyCode} {originalPrice}
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            {currencyCode} {price}
          </p>
        )}
      </div>

      <form action={updateAction} className="flex items-center gap-2">
        <input
          type="number"
          name="quantity"
          min={0}
          max={99}
          defaultValue={quantity}
          className="vm-focus-ring h-9 w-16 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-text-primary"
        />
        <Button type="submit" variant="ghost" size="sm" loading={updatePending}>
          {t("quantity")}
        </Button>
      </form>

      <p className="w-24 text-end font-display text-sm font-bold text-text-primary">
        {currencyCode} {lineTotal}
      </p>

      <form action={removeAction}>
        <Button type="submit" variant="ghost" size="sm" loading={removePending}>
          {t("remove")}
        </Button>
      </form>
    </div>
  );
}
