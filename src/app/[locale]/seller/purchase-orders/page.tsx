import { Link } from "@/i18n/navigation";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listPurchaseOrdersForSeller } from "@/server/services/purchaseOrders";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const STATUS_VARIANT = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
} as const;

export default async function SellerPurchaseOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const purchaseOrders = await listPurchaseOrdersForSeller(seller.id);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Purchase orders</h1>
        <Button href="/seller/purchase-orders/new" variant="primary">
          New purchase order
        </Button>
      </div>

      {purchaseOrders.length === 0 ? (
        <EmptyState title="No purchase orders yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {purchaseOrders.map((po) => (
            <Link key={po.id} href={`/seller/purchase-orders/${po.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">{po.supplier.companyName}</p>
                    <p className="text-sm text-text-muted">
                      {po.items.length} item{po.items.length === 1 ? "" : "s"} ·{" "}
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(po.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-text-primary">
                      {po.currencyCode} {po.total.toString()}
                    </span>
                    <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replaceAll("_", " ")}</Badge>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
