import { notFound } from "next/navigation";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { getPurchaseOrderForSeller, PurchaseOrderError } from "@/server/services/purchaseOrders";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PurchaseOrderActions } from "@/components/seller/PurchaseOrderActions";
import { PurchaseOrderReceiveForm } from "@/components/seller/PurchaseOrderReceiveForm";

const STATUS_VARIANT = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
} as const;

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const po = await getPurchaseOrderForSeller(seller.id, id).catch((err) => {
    if (err instanceof PurchaseOrderError) return null;
    throw err;
  });
  if (!po) notFound();

  return (
    <div className="vm-container flex max-w-2xl flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">{po.supplier.companyName}</h1>
          <p className="text-sm text-text-muted">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(po.createdAt)} ·{" "}
            {po.warehouse.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replaceAll("_", " ")}</Badge>
          <Badge variant={po.paymentStatus === "PAID" ? "success" : "neutral"}>{po.paymentStatus}</Badge>
        </div>
      </div>

      <Card>
        <CardBody>
          <PurchaseOrderActions purchaseOrderId={po.id} status={po.status} paymentStatus={po.paymentStatus} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-display text-sm font-bold text-text-primary">Line items</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          {po.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-text-primary">
                {item.product.name} ({item.product.sku})
              </span>
              <span className="text-text-secondary">
                {item.quantityReceived}/{item.quantityOrdered} received · {po.currencyCode}{" "}
                {item.unitCost.toString()} ea
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-1 border-t border-border-default pt-2 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span>
                {po.currencyCode} {po.subtotal.toString()}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Tax</span>
              <span>
                {po.currencyCode} {po.tax.toString()}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Shipping</span>
              <span>
                {po.currencyCode} {po.shipping.toString()}
              </span>
            </div>
            <div className="flex justify-between font-display font-bold text-text-primary">
              <span>Total</span>
              <span>
                {po.currencyCode} {po.total.toString()}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {["SUBMITTED", "PARTIALLY_RECEIVED"].includes(po.status) ? (
        <PurchaseOrderReceiveForm
          purchaseOrderId={po.id}
          items={po.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
          }))}
        />
      ) : null}
    </div>
  );
}
