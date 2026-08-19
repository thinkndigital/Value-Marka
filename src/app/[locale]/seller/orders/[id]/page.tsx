import { notFound } from "next/navigation";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { getSellerOrderForSeller, OrderError } from "@/server/services/orders";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { SellerOrderActions } from "@/components/SellerOrderActions";

export default async function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const sellerOrder = await getSellerOrderForSeller(seller.id, id).catch((err) => {
    if (err instanceof OrderError) return null;
    throw err;
  });
  if (!sellerOrder) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {sellerOrder.order.orderNumber}
          </h1>
          <p className="text-sm text-text-muted">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(sellerOrder.order.placedAt)}
          </p>
        </div>
        <OrderStatusBadge status={sellerOrder.status} />
      </div>

      <Card>
        <CardBody>
          <SellerOrderActions sellerOrderId={sellerOrder.id} status={sellerOrder.status} />
        </CardBody>
      </Card>

      {sellerOrder.order.address ? (
        <Card>
          <CardHeader>
            <p className="font-display text-sm font-bold text-text-primary">Shipping address</p>
          </CardHeader>
          <CardBody className="text-sm text-text-secondary">
            <p>{sellerOrder.order.address.fullName}</p>
            <p>{sellerOrder.order.address.phone}</p>
            <p>
              {sellerOrder.order.address.addressLine1}
              {sellerOrder.order.address.addressLine2 ? `, ${sellerOrder.order.address.addressLine2}` : ""}
            </p>
            <p>
              {sellerOrder.order.address.city}, {sellerOrder.order.address.countryCode}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <p className="font-display text-sm font-bold text-text-primary">Items</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          {sellerOrder.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-text-primary">
                {item.nameSnapshot} × {item.quantity}
              </span>
              <span className="text-text-secondary">
                {sellerOrder.order.currencyCode} {item.lineTotal.toString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border-default pt-2 font-display font-bold text-text-primary">
            <span>Subtotal</span>
            <span>
              {sellerOrder.order.currencyCode} {sellerOrder.subtotal.toString()}
            </span>
          </div>
        </CardBody>
      </Card>

      {sellerOrder.shipments.length > 0 ? (
        <Card>
          <CardHeader>
            <p className="font-display text-sm font-bold text-text-primary">Shipment</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 text-sm text-text-secondary">
            {sellerOrder.shipments.map((shipment) => (
              <p key={shipment.id}>
                {shipment.carrier} — {shipment.trackingNumber} ({shipment.status.replaceAll("_", " ")})
              </p>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {sellerOrder.refunds.length > 0 ? (
        <Card>
          <CardHeader>
            <p className="font-display text-sm font-bold text-text-primary">Refunds</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 text-sm text-text-secondary">
            {sellerOrder.refunds.map((refund) => (
              <p key={refund.id}>
                {sellerOrder.order.currencyCode} {refund.amount.toString()} — {refund.status}
                {refund.reason ? ` — ${refund.reason}` : ""}
              </p>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
