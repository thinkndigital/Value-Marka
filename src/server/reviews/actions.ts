"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { reviewSchema } from "@/server/validation/review";
import { createReview, ReviewError } from "@/server/services/reviews";

export interface ReviewFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

export async function createReviewAction(
  productId: string,
  productSlug: string,
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to write a review." };

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  try {
    await createReview(user.id, productId, parsed.data);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/product/${productSlug}`);
  return { success: true };
}
