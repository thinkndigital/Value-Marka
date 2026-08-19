import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { getSellerWithApplication } from "@/server/services/sellers";
import { SellerReviewPanel } from "@/components/admin/SellerReviewPanel";
import { approveSellerAction, rejectSellerAction } from "@/server/sellers/actions";

const STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
} as const;

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "sellers.read"))) {
    return <Forbidden />;
  }

  const seller = await getSellerWithApplication(id);
  if (!seller) notFound();

  const canApprove = await hasPermission(user.id, "sellers.approve");

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          {seller.storeName}
        </h1>
        <Badge variant={STATUS_VARIANT[seller.status]}>{seller.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-3 text-sm">
            <Row label="Store URL" value={`/store/${seller.storeSlug}`} />
            <Row
              label="Applicant"
              value={`${seller.user.firstName} ${seller.user.lastName} (${seller.user.email})`}
            />
            <Row label="Country" value={seller.country.name} />
            <Row label="Business type" value={seller.application?.businessType ?? "—"} />
            <Row label="Tax ID" value={seller.application?.taxId ?? "—"} />
            {seller.description ? (
              <Row label="Description" value={seller.description} />
            ) : null}
            {seller.application?.rejectionReason ? (
              <Row label="Rejection reason" value={seller.application.rejectionReason} />
            ) : null}
          </CardBody>
        </Card>

        {canApprove ? (
          <Card>
            <CardBody>
              {seller.status === "PENDING" ? (
                <SellerReviewPanel
                  approveAction={approveSellerAction.bind(null, seller.id)}
                  rejectAction={rejectSellerAction.bind(null, seller.id)}
                />
              ) : (
                <p className="text-sm text-text-secondary">
                  This application has already been reviewed
                  {seller.application?.reviewedAt
                    ? ` on ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(seller.application.reviewedAt)}`
                    : ""}
                  .
                </p>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-default pb-3 last:border-0">
      <span className="text-xs font-semibold uppercase text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
