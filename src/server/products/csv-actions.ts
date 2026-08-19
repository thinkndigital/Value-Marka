"use server";

import { revalidatePath } from "next/cache";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { importProductsCsv, type CsvImportResult } from "@/server/services/product-csv";
import { ProductError } from "@/server/services/products";

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2MB

export interface CsvImportFormState {
  error?: string;
  result?: CsvImportResult;
}

export async function importProductsCsvAction(
  _prevState: CsvImportFormState,
  formData: FormData,
): Promise<CsvImportFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.create", seller.id);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a CSV file to upload." };
    }
    if (file.size > MAX_CSV_BYTES) {
      return { error: "File must be 2MB or smaller." };
    }

    const warehouseId = String(formData.get("warehouseId") ?? "");
    if (!warehouseId) {
      return { error: "Select a warehouse for newly created products." };
    }

    const text = await file.text();
    const result = await importProductsCsv(seller.id, text, warehouseId, user.id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "product.csv_imported",
      entityType: "Seller",
      entityId: seller.id,
      newValue: {
        created: result.created,
        updated: result.updated,
        errorCount: result.errors.length,
      },
    });

    revalidatePath("/seller/products");
    return { result };
  } catch (err) {
    if (
      err instanceof UnauthorizedError ||
      err instanceof ForbiddenError ||
      err instanceof ProductError
    ) {
      return { error: err.message };
    }
    throw err;
  }
}
