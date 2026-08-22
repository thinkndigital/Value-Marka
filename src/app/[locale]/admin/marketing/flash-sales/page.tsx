import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { listFlashSales } from "@/server/services/flashSales";
import { deleteFlashSaleAction, toggleFlashSaleAction } from "@/server/flashSales/actions";

function statusBadge(sale: { isActive: boolean; startsAt: Date; endsAt: Date }) {
  const now = new Date();
  if (!sale.isActive) return <Badge variant="neutral">Disabled</Badge>;
  if (now < sale.startsAt) return <Badge variant="warning">Scheduled</Badge>;
  if (now > sale.endsAt) return <Badge variant="neutral">Ended</Badge>;
  return <Badge variant="success">Live</Badge>;
}

export default async function AdminFlashSalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "campaigns.read"))) {
    return <Forbidden />;
  }

  const canUpdate = await hasPermission(user.id, "campaigns.update");
  const canDelete = await hasPermission(user.id, "campaigns.delete");
  const sales = await listFlashSales();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Flash sales</h1>
          <p className="text-sm text-text-muted">
            Checkout validates every flash-sale price and stock claim against the database — a
            customer&apos;s browser countdown is display-only.
          </p>
        </div>
        {canUpdate ? (
          <Button href="/admin/marketing/flash-sales/new" variant="primary" size="sm">
            New flash sale
          </Button>
        ) : null}
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="No flash sales yet"
          description="Create one and add products to start a time-boxed, server-validated discount."
          action={
            canUpdate ? (
              <Button href="/admin/marketing/flash-sales/new" variant="primary">
                New flash sale
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Name</th>
                <th className="px-4 py-3 text-start">Window</th>
                <th className="px-4 py-3 text-start">Products</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{sale.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {sale.startsAt.toLocaleString()} → {sale.endsAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{sale.items.length}</td>
                  <td className="px-4 py-3">{statusBadge(sale)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <>
                          <FormActionButton
                            action={toggleFlashSaleAction.bind(null, sale.id)}
                            label={sale.isActive ? "Disable" : "Enable"}
                            variant="outline"
                          />
                          <Button href={`/admin/marketing/flash-sales/${sale.id}`} variant="outline" size="sm">
                            Manage
                          </Button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <DeleteButton
                          action={deleteFlashSaleAction.bind(null, sale.id)}
                          confirmMessage={`Delete "${sale.name}"? This cannot be undone.`}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
