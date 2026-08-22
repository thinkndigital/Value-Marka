import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { RewardRuleForm } from "@/components/admin/RewardRuleForm";
import { listRewardRules } from "@/server/services/loyalty";
import { deleteRewardRuleAction } from "@/server/loyalty/actions";

export default async function AdminLoyaltyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "campaigns.read"))) {
    return <Forbidden />;
  }
  const canUpdate = await hasPermission(user.id, "campaigns.update");
  const canDelete = await hasPermission(user.id, "campaigns.delete");

  const rules = await listRewardRules();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Loyalty &amp; rewards</h1>
        <p className="text-sm text-text-muted">
          Customers earn points automatically when a seller marks their order delivered, at
          whichever rule was in effect at that moment — rule history is append-only, so changing
          the rate never recalculates points already earned. Only a rule that hasn&apos;t taken
          effect yet can be removed.
        </p>
      </div>

      {canUpdate ? (
        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold text-text-primary">Add a rule</h2>
          </CardHeader>
          <CardBody>
            <RewardRuleForm />
          </CardBody>
        </Card>
      ) : null}

      {rules.length === 0 ? (
        <EmptyState
          title="No reward rule configured yet"
          description="Until a rule exists, orders won't earn any points."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Earn rate</th>
                <th className="px-4 py-3 text-start">Redemption value</th>
                <th className="px-4 py-3 text-start">Effective from</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const isFuture = rule.effectiveAt > new Date();
                return (
                  <tr key={rule.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3 text-text-secondary">
                      {Number(rule.pointsPerCurrencyUnit)} pt / unit
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {Number(rule.redemptionValue)} / point
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                        rule.effectiveAt,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isFuture ? "warning" : "success"}>
                        {isFuture ? "Scheduled" : "In effect"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canDelete && isFuture ? (
                          <DeleteButton
                            action={deleteRewardRuleAction.bind(null, rule.id)}
                            confirmMessage="Remove this scheduled rule?"
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
