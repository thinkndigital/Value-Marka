import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/server/auth/guards";
import { listOrdersForUser } from "@/server/services/checkout";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Orders");

  const orders = await listOrdersForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

      {orders.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.orderNumber}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">
                      {t("orderNumber", { number: order.orderNumber })}
                    </p>
                    <p className="text-sm text-text-muted">
                      {t("placedOn", {
                        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                          order.placedAt,
                        ),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-text-primary">
                      {order.currencyCode} {order.grandTotal.toString()}
                    </span>
                    <Badge variant="neutral">{order.status}</Badge>
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
