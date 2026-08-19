import type { OrderStatus } from "@prisma/client";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const VARIANTS: Record<OrderStatus, BadgeVariant> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  PROCESSING: "info",
  PACKED: "info",
  SHIPPED: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURN_REQUESTED: "warning",
  RETURNED: "warning",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANTS[status]}>{status.replaceAll("_", " ")}</Badge>;
}
