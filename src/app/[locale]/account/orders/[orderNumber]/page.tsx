import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth/guards";
import { getOrderForUser, CheckoutError } from "@/server/services/checkout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Orders");
  const tCheckout = await getTranslations("Checkout");

  const order = await getOrderForUser(user.id, orderNumber).catch((err) => {
    if (err instanceof CheckoutError) return null;
    throw err;
  });
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {t("orderNumber", { number: order.orderNumber })}
          </h1>
          <p className="text-sm text-text-muted">
            {t("placedOn", {
              date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.placedAt),
            })}
          </p>
        </div>
        <Badge variant="neutral">{order.status}</Badge>
      </div>

      {order.address ? (
        <Card>
          <CardHeader>
            <p className="font-display text-sm font-bold text-text-primary">
              {t("shippingAddress")}
            </p>
          </CardHeader>
          <CardBody className="text-sm text-text-secondary">
            <p>{order.address.fullName}</p>
            <p>{order.address.phone}</p>
            <p>
              {order.address.addressLine1}
              {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""}
            </p>
            <p>
              {order.address.city}, {order.address.countryCode}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {order.sellerOrders.map((sellerOrder) => (
        <Card key={sellerOrder.id}>
          <CardHeader className="flex items-center justify-between">
            <p className="font-display text-sm font-bold text-text-primary">
              {t("soldBy", { storeName: sellerOrder.seller.storeName })}
            </p>
            <Badge variant="neutral">{sellerOrder.status}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {sellerOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">
                  {item.nameSnapshot} × {item.quantity}
                </span>
                <span className="text-text-secondary">
                  {order.currencyCode} {item.lineTotal.toString()}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardBody className="flex flex-col gap-2">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>{tCheckout("subtotal")}</span>
            <span>
              {order.currencyCode} {order.subtotal.toString()}
            </span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>{tCheckout("tax")}</span>
            <span>
              {order.currencyCode} {order.taxTotal.toString()}
            </span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>{tCheckout("shipping")}</span>
            <span>
              {order.currencyCode} {order.shippingTotal.toString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-border-default pt-2 font-display font-bold text-text-primary">
            <span>{tCheckout("total")}</span>
            <span>
              {order.currencyCode} {order.grandTotal.toString()}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
