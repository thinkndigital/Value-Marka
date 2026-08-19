import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getSellerForUser } from "@/server/services/sellers";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SellerApplicationForm } from "@/components/seller/SellerApplicationForm";

const STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
} as const;

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const seller = await getSellerForUser(user.id);

  if (seller) {
    return (
      <div className="vm-container flex flex-col gap-6 py-16">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Your seller application
        </h1>
        <Card className="max-w-lg">
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold text-text-primary">
                {seller.storeName}
              </p>
              <Badge variant={STATUS_VARIANT[seller.status]}>{seller.status}</Badge>
            </div>
            {seller.status === "PENDING" ? (
              <p className="text-sm text-text-secondary">
                We&rsquo;re reviewing your application. This usually takes 1–2
                business days.
              </p>
            ) : null}
            {seller.status === "REJECTED" ? (
              <p className="text-sm text-text-secondary">
                {seller.application?.rejectionReason ??
                  "Your application wasn't approved."}
              </p>
            ) : null}
            {seller.status === "APPROVED" ? (
              <>
                <p className="text-sm text-text-secondary">
                  Your store is live at /store/{seller.storeSlug}.
                </p>
                <Button href="/seller" variant="primary">
                  Go to seller dashboard
                </Button>
              </>
            ) : null}
          </CardBody>
        </Card>
      </div>
    );
  }

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { code: true, name: true },
  });

  return (
    <div className="vm-container flex flex-col gap-6 py-16">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Sell on Value Marka
        </h1>
        <p className="text-text-secondary">
          Tell us about your business — an admin reviews every application
          before your store goes live.
        </p>
      </div>
      <Card className="max-w-lg">
        <CardBody>
          <SellerApplicationForm countries={countries} />
        </CardBody>
      </Card>
    </div>
  );
}
