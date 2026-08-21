import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAffiliatesForAdmin } from "@/server/services/affiliates";
import { approveAffiliateAction, suspendAffiliateAction } from "@/server/affiliates/actions";
import { AffiliateActions } from "@/components/admin/AffiliateActions";

const STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  SUSPENDED: "danger",
} as const;

export default async function AdminAffiliatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "affiliates.manage"))) {
    return <Forbidden />;
  }

  const affiliates = await listAffiliatesForAdmin();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Affiliates</h1>

      {affiliates.length === 0 ? (
        <EmptyState
          title="No affiliate applications yet"
          description="Customers who apply to the affiliate program will show up here."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Affiliate</th>
                <th className="px-4 py-3 text-start">Code</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((affiliate) => (
                <tr key={affiliate.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 text-text-secondary">
                    {affiliate.user.firstName} {affiliate.user.lastName}
                    <br />
                    <span className="text-xs text-text-muted">{affiliate.user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-text-primary">{affiliate.affiliateCode}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[affiliate.status]}>{affiliate.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <AffiliateActions
                      status={affiliate.status}
                      approveAction={approveAffiliateAction.bind(null, affiliate.id)}
                      suspendAction={suspendAffiliateAction.bind(null, affiliate.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
