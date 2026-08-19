"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import * as wishlistService from "@/server/services/wishlist";

export interface WishlistFormState {
  error?: string;
  success?: boolean;
}

export async function addToWishlistAction(
  productId: string,
  productSlug: string,
  _prevState: WishlistFormState,
  _formData: FormData,
): Promise<WishlistFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to use your wishlist." };

  await wishlistService.addToWishlist(user.id, productId);
  revalidatePath(`/product/${productSlug}`);
  revalidatePath("/account/wishlist");
  return { success: true };
}

export async function removeFromWishlistAction(
  productId: string,
  productSlug: string | undefined,
  _prevState: WishlistFormState,
  _formData: FormData,
): Promise<WishlistFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to use your wishlist." };

  await wishlistService.removeFromWishlist(user.id, productId);
  if (productSlug) revalidatePath(`/product/${productSlug}`);
  revalidatePath("/account/wishlist");
  return { success: true };
}
