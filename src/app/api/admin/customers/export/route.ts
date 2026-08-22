import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { listCustomers, getCustomerProfile } from "@/server/services/crm";
import { customersToCsv } from "@/server/services/customer-csv";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "customers.read");

    const customers = await listCustomers();
    const rows = await Promise.all(
      customers.map(async (customer) => {
        const profile = await getCustomerProfile(customer.id);
        return {
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          createdAt: customer.createdAt,
          orderCount: profile.orderCount,
          lifetimeValue: profile.lifetimeValue,
          averageOrderValue: profile.averageOrderValue,
          currencyCode: profile.currencyCode,
          lastOrderAt: profile.lastOrderAt,
        };
      }),
    );

    const csv = customersToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="customers.csv"',
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
