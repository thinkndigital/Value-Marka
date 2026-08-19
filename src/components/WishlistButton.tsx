"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  addToWishlistAction,
  removeFromWishlistAction,
  type WishlistFormState,
} from "@/server/wishlist/actions";

export function WishlistButton({
  productId,
  productSlug,
  initialWishlisted,
  signedIn,
}: {
  productId: string;
  productSlug: string;
  initialWishlisted: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("Product");
  const boundAdd = addToWishlistAction.bind(null, productId, productSlug);
  const boundRemove = removeFromWishlistAction.bind(null, productId, productSlug);
  const [addState, addAction, addPending] = useActionState<WishlistFormState, FormData>(
    boundAdd,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState<WishlistFormState, FormData>(
    boundRemove,
    {},
  );

  if (!signedIn) {
    return null;
  }

  const wishlisted = initialWishlisted
    ? !removeState.success
    : Boolean(addState.success);

  if (wishlisted) {
    return (
      <form action={removeAction}>
        <Button type="submit" variant="outline" size="lg" loading={removePending}>
          {t("wishlistRemove")}
        </Button>
      </form>
    );
  }

  return (
    <form action={addAction}>
      <Button type="submit" variant="outline" size="lg" loading={addPending}>
        {t("wishlistAdd")}
      </Button>
    </form>
  );
}
