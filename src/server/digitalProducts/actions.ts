"use server";

import { getCurrentUser } from "@/server/auth/dal";
import { UnauthorizedError } from "@/server/rbac";
import { getDownloadUrlForOrderItem, DigitalProductError } from "@/server/services/digitalProducts";

export interface DownloadFormState {
  error?: string;
  url?: string;
  fileName?: string;
}

export async function requestDigitalDownloadAction(
  orderItemId: string,
  _prevState: DownloadFormState,
  _formData: FormData,
): Promise<DownloadFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { url, fileName } = await getDownloadUrlForOrderItem(user.id, orderItemId);
    return { url, fileName };
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof DigitalProductError) {
      return { error: err.message };
    }
    throw err;
  }
}
