"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { bundleComponentSchema } from "@/server/validation/bundles";
import * as bundleService from "@/server/services/bundles";
import { BundleError } from "@/server/services/bundles";
import { ForbiddenError, UnauthorizedError } from "@/server/rbac";

export interface BundleFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function handleBundleError(err: unknown): BundleFormState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof BundleError) {
    return { error: err.message };
  }
  throw err;
}

export async function addBundleComponentAction(
  bundleProductId: string,
  _prevState: BundleFormState,
  formData: FormData,
): Promise<BundleFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.update", seller.id);

    const parsed = bundleComponentSchema.safeParse({
      componentProductId: formData.get("componentProductId"),
      quantity: formData.get("quantity"),
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const item = await bundleService.addBundleComponent(
      seller.id,
      bundleProductId,
      parsed.data.componentProductId,
      parsed.data.quantity,
    );

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "bundle.component_added",
      entityType: "ProductBundleItem",
      entityId: item.id,
      newValue: { bundleProductId, componentProductId: parsed.data.componentProductId, quantity: parsed.data.quantity },
    });

    revalidatePath(`/seller/products/${bundleProductId}`);
    return { success: true };
  } catch (err) {
    return handleBundleError(err);
  }
}

export async function removeBundleComponentAction(
  id: string,
  bundleProductId: string,
  _prevState: BundleFormState,
  _formData: FormData,
): Promise<BundleFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.update", seller.id);

    await bundleService.removeBundleComponent(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "bundle.component_removed",
      entityType: "ProductBundleItem",
      entityId: id,
    });

    revalidatePath(`/seller/products/${bundleProductId}`);
    return { success: true };
  } catch (err) {
    return handleBundleError(err);
  }
}
