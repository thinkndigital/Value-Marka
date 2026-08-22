import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { listCurrencies } from "@/server/services/currency";
import { toggleCurrencyAction } from "@/server/currency/actions";

export default async function AdminCurrenciesPage({
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
  const currencies = await listCurrencies();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Currencies</h1>
        <p className="text-sm text-text-muted">
          Every currency products, orders, and the ledger already use — enable/disable which ones
          are supported, or fix a symbol/display name.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
            <tr>
              <th className="px-4 py-3 text-start">Code</th>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Symbol</th>
              <th className="px-4 py-3 text-start">Decimals</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((currency) => (
              <tr key={currency.code} className="border-b border-border-default last:border-0">
                <td className="px-4 py-3 font-medium text-text-primary">{currency.code}</td>
                <td className="px-4 py-3 text-text-secondary">{currency.name}</td>
                <td className="px-4 py-3 text-text-secondary">{currency.symbol}</td>
                <td className="px-4 py-3 text-text-secondary">{currency.decimalDigits}</td>
                <td className="px-4 py-3">
                  <Badge variant={currency.isActive ? "success" : "neutral"}>
                    {currency.isActive ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canUpdate ? (
                      <>
                        <FormActionButton
                          action={toggleCurrencyAction.bind(null, currency.code)}
                          label={currency.isActive ? "Disable" : "Enable"}
                          variant="outline"
                        />
                        <Button href={`/admin/settings/currencies/${currency.code}`} variant="outline" size="sm">
                          Edit
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
