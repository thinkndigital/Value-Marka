import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { listPlatformCoupons } from "@/server/services/coupons";
import { createPlatformCouponAction, deactivatePlatformCouponAction } from "@/server/coupons/actions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { CouponForm } from "@/components/CouponForm";

export default async function AdminCouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "coupons.read"))) {
    return <Forbidden />;
  }

  const coupons = await listPlatformCoupons();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Platform coupons</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {coupons.length === 0 ? (
            <EmptyState title="No platform coupons yet" />
          ) : (
            coupons.map((coupon) => (
              <Card key={coupon.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">{coupon.code}</p>
                    <p className="text-sm text-text-secondary">
                      {coupon.type === "FREE_SHIPPING"
                        ? "Free shipping"
                        : coupon.type === "PERCENTAGE"
                          ? `${coupon.value}% off`
                          : `${coupon.value} off`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={coupon.isActive ? "success" : "neutral"}>
                      {coupon.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {coupon.isActive ? (
                      <DeleteButton
                        action={deactivatePlatformCouponAction.bind(null, coupon.id)}
                        confirmMessage="Deactivate this coupon?"
                        label="Deactivate"
                      />
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <CouponForm action={createPlatformCouponAction} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
