import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ExchangeRateForm } from "@/components/admin/ExchangeRateForm";
import { listCurrencies, listExchangeRates } from "@/server/services/currency";
import { deleteExchangeRateAction } from "@/server/currency/actions";

export default async function AdminExchangeRatesPage({
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
  const [rates, currencies] = await Promise.all([listExchangeRates(), listCurrencies()]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Exchange rates</h1>
        <p className="text-sm text-text-muted">
          Rate history is append-only — adding a new rate never rewrites an earlier one, so
          anything computed with a past rate stays correct. Only a rate that hasn&apos;t taken
          effect yet can be removed.
        </p>
      </div>

      {canUpdate ? (
        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold text-text-primary">Add a rate</h2>
          </CardHeader>
          <CardBody>
            <ExchangeRateForm currencies={currencies} />
          </CardBody>
        </Card>
      ) : null}

      {rates.length === 0 ? (
        <EmptyState title="No exchange rates yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Pair</th>
                <th className="px-4 py-3 text-start">Rate</th>
                <th className="px-4 py-3 text-start">Effective from</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const isFuture = rate.effectiveAt > new Date();
                return (
                  <tr key={rate.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {rate.fromCode} → {rate.toCode}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{Number(rate.rate)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                        rate.effectiveAt,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isFuture ? "warning" : "success"}>
                        {isFuture ? "Scheduled" : "In effect"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canUpdate && isFuture ? (
                          <DeleteButton
                            action={deleteExchangeRateAction.bind(null, rate.id)}
                            confirmMessage="Remove this scheduled rate?"
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
