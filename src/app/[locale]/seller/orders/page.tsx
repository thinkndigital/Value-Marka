import type { OrderStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listSellerOrders } from "@/server/services/orders";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage } from "@/server/pagination";

const STATUS_FILTERS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURN_REQUESTED",
  "CANCELLED",
];

export default async function SellerOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { status, page: pageParam } = await searchParams;
  const { seller } = await requireApprovedSeller(locale);

  const validStatus = STATUS_FILTERS.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const page = parsePage(pageParam);
  const { items: orders, totalPages } = await listSellerOrders(seller.id, validStatus, page);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Orders</h1>

      <div className="flex flex-wrap gap-2">
        <Link href="/seller/orders">
          <span
            className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ${
              !validStatus ? "bg-yellow-400 text-text-on-yellow" : "bg-bg-sunken text-text-secondary"
            }`}
          >
            All
          </span>
        </Link>
        {STATUS_FILTERS.map((s) => (
          <Link key={s} href={{ pathname: "/seller/orders", query: { status: s } }}>
            <span
              className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ${
                validStatus === s ? "bg-yellow-400 text-text-on-yellow" : "bg-bg-sunken text-text-secondary"
              }`}
            >
              {s.replaceAll("_", " ")}
            </span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders here yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/seller/orders/${order.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">
                      {order.order.orderNumber}
                    </p>
                    <p className="text-sm text-text-muted">
                      {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        order.order.placedAt,
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-text-primary">
                      {order.order.currencyCode} {order.subtotal.toString()}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/seller/orders"
        extraQuery={validStatus ? { status: validStatus } : {}}
      />
    </div>
  );
}
