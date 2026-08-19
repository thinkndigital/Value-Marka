import { NextResponse } from "next/server";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { exportProductsCsv } from "@/server/services/product-csv";

export async function GET() {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "products.read", seller.id);

    const csv = await exportProductsCsv(seller.id);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${seller.storeSlug}-products.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
