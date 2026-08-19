import type { PayoutStatus } from "@prisma/client";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { listPayoutsForAdmin } from "@/server/services/payouts";
import { AdminPayoutActions } from "@/components/AdminPayoutActions";

const STATUS_VARIANT: Record<PayoutStatus, "neutral" | "success" | "danger" | "warning" | "info"> = {
  PENDING: "warning",
  APPROVED: "info",
  PROCESSING: "info",
  PAID: "success",
  REJECTED: "danger",
  ON_HOLD: "neutral",
};

const TABS: { label: string; value: PayoutStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "On hold", value: "ON_HOLD" },
  { label: "Paid", value: "PAID" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

export default async function AdminPayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: statusParam } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "payouts.read"))) {
    return <Forbidden />;
  }

  const status = (TABS.find((t) => t.value === statusParam)?.value ?? "PENDING") as
    | PayoutStatus
    | "ALL";
  const payouts = await listPayoutsForAdmin(status === "ALL" ? undefined : status);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Payouts</h1>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link key={tab.value} href={{ pathname: "/admin/payouts", query: { status: tab.value } }}>
            <Badge variant={status === tab.value ? "brand" : "neutral"}>{tab.label}</Badge>
          </Link>
        ))}
      </div>

      {payouts.length === 0 ? (
        <EmptyState title="No payouts here" />
      ) : (
        <div className="flex flex-col gap-4">
          {payouts.map((payout) => (
            <Card key={payout.id}>
              <CardBody className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display font-semibold text-text-primary">
                    {payout.seller.storeName}
                  </p>
                  <p className="text-sm text-text-muted">
                    {payout.method ?? "STRIPE"} ·{" "}
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(payout.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display font-bold text-text-primary">
                    {payout.currencyCode} {payout.amount.toString()}
                  </span>
                  <Badge variant={STATUS_VARIANT[payout.status]}>{payout.status.replaceAll("_", " ")}</Badge>
                  <AdminPayoutActions payoutId={payout.id} status={payout.status} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
