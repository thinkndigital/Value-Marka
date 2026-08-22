"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import * as sellerFollowService from "@/server/services/sellerFollow";

export interface SellerFollowFormState {
  error?: string;
  success?: boolean;
}

export async function followSellerAction(
  sellerId: string,
  storeSlug: string,
  _prevState: SellerFollowFormState,
  _formData: FormData,
): Promise<SellerFollowFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to follow sellers." };

  await sellerFollowService.followSeller(user.id, sellerId);
  revalidatePath(`/store/${storeSlug}`);
  revalidatePath("/account/following");
  return { success: true };
}

export async function unfollowSellerAction(
  sellerId: string,
  storeSlug: string,
  _prevState: SellerFollowFormState,
  _formData: FormData,
): Promise<SellerFollowFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to follow sellers." };

  await sellerFollowService.unfollowSeller(user.id, sellerId);
  revalidatePath(`/store/${storeSlug}`);
  revalidatePath("/account/following");
  return { success: true };
}
