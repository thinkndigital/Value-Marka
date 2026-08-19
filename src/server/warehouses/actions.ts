"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { warehouseSchema } from "@/server/validation/warehouse";
import { createWarehouse } from "@/server/services/warehouses";

export interface WarehouseFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

export async function createWarehouseAction(
  _prevState: WarehouseFormState,
  formData: FormData,
): Promise<WarehouseFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "warehouses.create", seller.id);

    const parsed = warehouseSchema.safeParse({
      name: formData.get("name"),
      countryCode: formData.get("countryCode"),
      city: formData.get("city"),
      addressLine: formData.get("addressLine"),
      isDefault: formData.get("isDefault") === "on",
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const warehouse = await createWarehouse(seller.id, parsed.data, parsed.data.isDefault);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "warehouse.created",
      entityType: "Warehouse",
      entityId: warehouse.id,
      newValue: { name: warehouse.name, sellerId: seller.id },
    });

    revalidatePath("/seller/warehouses");
    return { success: true };
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      return { error: err.message };
    }
    throw err;
  }
}
