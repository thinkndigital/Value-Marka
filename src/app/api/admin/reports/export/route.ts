import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { getPlatformFinancialReport } from "@/server/services/reports";
import { financialReportToCsv } from "@/server/services/reports-csv";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "reports.export");

    const url = new URL(request.url);
    const currency = url.searchParams.get("currency");
    if (!currency) {
      return NextResponse.json({ error: "A currency is required." }, { status: 400 });
    }
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const report = await getPlatformFinancialReport(currency, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    const csv = financialReportToCsv(report);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="platform-report-${currency}.csv"`,
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
