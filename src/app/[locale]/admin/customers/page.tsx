import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { listCustomersPage, getCustomerProfile } from "@/server/services/crm";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { parsePage } from "@/server/pagination";

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "customers.read"))) {
    return <Forbidden />;
  }

  const page = parsePage(pageParam);
  const { items: customers, totalPages } = await listCustomersPage(page);
  const profiles = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      profile: await getCustomerProfile(customer.id),
    })),
  );

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Customers</h1>
        <Button href="/api/admin/customers/export" variant="outline" size="sm">
          Export CSV
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="No customers yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {profiles.map(({ customer, profile }) => (
            <Card key={customer.id}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-text-primary">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-sm text-text-muted">{customer.email}</p>
                </div>
                <div className="flex gap-6 text-sm text-text-secondary">
                  <div className="text-end">
                    <p className="font-display font-bold text-text-primary">{profile.orderCount}</p>
                    <p>Orders</p>
                  </div>
                  <div className="text-end">
                    <p className="font-display font-bold text-text-primary">
                      {profile.currencyCode ?? ""} {profile.lifetimeValue.toFixed(2)}
                    </p>
                    <p>LTV</p>
                  </div>
                  <div className="text-end">
                    <p className="font-display font-bold text-text-primary">
                      {profile.currencyCode ?? ""} {profile.averageOrderValue.toFixed(2)}
                    </p>
                    <p>AOV</p>
                  </div>
                  <div className="text-end">
                    <p className="font-display font-bold text-text-primary">
                      {profile.lastOrderAt
                        ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                            profile.lastOrderAt,
                          )
                        : "—"}
                    </p>
                    <p>Last order</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} basePath="/admin/customers" />
    </div>
  );
}
