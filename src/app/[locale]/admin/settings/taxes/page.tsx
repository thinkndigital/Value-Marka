import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { listTaxRules } from "@/server/services/settings";
import { deleteTaxRuleAction, toggleTaxRuleAction } from "@/server/settings/actions";

export default async function AdminTaxesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.read"))) {
    return <Forbidden />;
  }

  const canUpdate = await hasPermission(user.id, "settings.update");
  const rules = await listTaxRules();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Tax rules</h1>
          <p className="text-sm text-text-muted">
            Checkout sums every active rule for the shipping country and applies it to the order —
            changes here take effect on the next order placed.
          </p>
        </div>
        {canUpdate ? (
          <Button href="/admin/settings/taxes/new" variant="primary" size="sm">
            New tax rule
          </Button>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No tax rules yet"
          description="Without a rule, checkout charges no tax for that country."
          action={
            canUpdate ? (
              <Button href="/admin/settings/taxes/new" variant="primary">
                New tax rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Country</th>
                <th className="px-4 py-3 text-start">Name</th>
                <th className="px-4 py-3 text-start">Rate</th>
                <th className="px-4 py-3 text-start">Applies to</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 text-text-secondary">{rule.country.name}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{rule.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {(Number(rule.rate) * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{rule.appliesTo}</td>
                  <td className="px-4 py-3">
                    <Badge variant={rule.isActive ? "success" : "neutral"}>
                      {rule.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <>
                          <FormActionButton
                            action={toggleTaxRuleAction.bind(null, rule.id)}
                            label={rule.isActive ? "Disable" : "Enable"}
                            variant="outline"
                          />
                          <Button href={`/admin/settings/taxes/${rule.id}`} variant="outline" size="sm">
                            Edit
                          </Button>
                          <DeleteButton
                            action={deleteTaxRuleAction.bind(null, rule.id)}
                            confirmMessage={`Delete "${rule.name}"? This cannot be undone.`}
                          />
                        </>
                      ) : null}
                    </div>
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
