"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { removeFromWishlistAction, type WishlistFormState } from "@/server/wishlist/actions";

export function RemoveFromWishlistButton({
  productId,
  label,
}: {
  productId: string;
  label: string;
}) {
  const boundAction = removeFromWishlistAction.bind(null, productId, undefined);
  const [, formAction, pending] = useActionState<WishlistFormState, FormData>(boundAction, {});

  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" loading={pending} className="w-full">
        {label}
      </Button>
    </form>
  );
}
