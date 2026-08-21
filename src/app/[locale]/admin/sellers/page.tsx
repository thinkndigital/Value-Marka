import type { SellerStatus } from "@prisma/client";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { listSellerApplications } from "@/server/services/sellers";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage } from "@/server/pagination";

const STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
} as const;

const TABS: { label: string; value: SellerStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

export default async function AdminSellersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { status: statusParam, page: pageParam } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "sellers.read"))) {
    return <Forbidden />;
  }

  const status =
    statusParam && ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(statusParam)
      ? (statusParam as SellerStatus)
      : "PENDING";
  const page = parsePage(pageParam);

  const { items: sellers, totalPages } = await listSellerApplications(status, page);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        Seller applications
      </h1>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "ALL" ? "/admin/sellers" : `/admin/sellers?status=${tab.value}`}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ${
              (tab.value === "ALL" && !statusParam) || tab.value === status
                ? "bg-navy-600 text-white"
                : "bg-bg-sunken text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {sellers.length === 0 ? (
        <EmptyState
          title="No applications here"
          description="Seller applications matching this filter will show up here."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Store</th>
                <th className="px-4 py-3 text-start">Applicant</th>
                <th className="px-4 py-3 text-start">Country</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => (
                <tr key={seller.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{seller.storeName}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {seller.user.firstName} {seller.user.lastName}
                    <br />
                    <span className="text-xs text-text-muted">{seller.user.email}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{seller.countryCode}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[seller.status]}>{seller.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button href={`/admin/sellers/${seller.id}`} variant="outline" size="sm">
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination page={page} totalPages={totalPages} basePath="/admin/sellers" extraQuery={{ status }} />
    </div>
  );
}
