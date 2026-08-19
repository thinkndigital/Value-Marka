"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrCreateCart, getCurrentCart } from "./resolve";
import * as cartService from "@/server/services/cart";
import { CartError } from "@/server/services/cart";

export interface CartFormState {
  error?: string;
  success?: boolean;
}

const addSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export async function addToCartAction(
  _prevState: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  try {
    const parsed = addSchema.safeParse({
      productId: formData.get("productId"),
      variantId: formData.get("variantId") || undefined,
      quantity: formData.get("quantity") || 1,
    });
    if (!parsed.success) return { error: "Invalid request." };

    const cart = await getOrCreateCart();
    await cartService.addToCart(
      cart.id,
      parsed.data.productId,
      parsed.data.quantity,
      parsed.data.variantId,
    );

    revalidatePath("/cart");
    return { success: true };
  } catch (err) {
    if (err instanceof CartError) return { error: err.message };
    throw err;
  }
}

export async function updateCartItemAction(
  itemId: string,
  quantity: number,
  _prevState: CartFormState,
  _formData: FormData,
): Promise<CartFormState> {
  try {
    const cart = await getCurrentCart();
    if (!cart) throw new CartError("Cart not found.");
    await cartService.updateCartItemQuantity(cart.id, itemId, quantity);
    revalidatePath("/cart");
    return { success: true };
  } catch (err) {
    if (err instanceof CartError) return { error: err.message };
    throw err;
  }
}

export async function removeCartItemAction(
  itemId: string,
  _prevState: CartFormState,
  _formData: FormData,
): Promise<CartFormState> {
  try {
    const cart = await getCurrentCart();
    if (!cart) throw new CartError("Cart not found.");
    await cartService.removeCartItem(cart.id, itemId);
    revalidatePath("/cart");
    return { success: true };
  } catch (err) {
    if (err instanceof CartError) return { error: err.message };
    throw err;
  }
}
