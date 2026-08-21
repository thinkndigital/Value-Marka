import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SalesTrendChart } from "@/components/admin/SalesTrendChart";
import { listCurrenciesWithLedgerActivity } from "@/server/services/reports";
import {
  getSalesTrend,
  getInventoryTurnover,
  getTopProductsBySeller,
  daysAgoRange,
} from "@/server/services/analytics";

const DAY_OPTIONS = [7, 30, 90];

export default async function SellerAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ currency?: string; days?: string }>;
}) {
  const { locale } = await params;
  const { currency: currencyParam, days: daysParam } = await searchParams;
  const { seller } = await requireApprovedSeller(locale);

  const currencies = await listCurrenciesWithLedgerActivity("SELLER", seller.id);
  const currency = currencyParam && currencies.includes(currencyParam) ? currencyParam : currencies[0];
  const days = DAY_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  if (!currency) {
    return (
      <div className="vm-container py-16">
        <EmptyState
          title="No sales activity yet"
          description="Analytics appear here once a customer's payment is captured for one of your orders."
        />
      </div>
    );
  }

  const range = daysAgoRange(days);

  const [trend, turnover, topProducts] = await Promise.all([
    getSalesTrend(currency, days, seller.id),
    getInventoryTurnover(currency, range, seller.id),
    getTopProductsBySeller(seller.id, range),
  ]);

  return (
    <div className="vm-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Analytics</h1>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="currency" className="text-sm font-medium text-text-secondary">
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={currency}
            className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="days" className="text-sm font-medium text-text-secondary">
            Period
          </label>
          <select
            id="days"
            name="days"
            defaultValue={days}
            className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
      </form>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text-primary">Sales trend</h2>
          <SalesTrendChart points={trend} currencyCode={currency} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold text-text-primary">Inventory turnover</h2>
          <p className="text-sm text-text-secondary">
            COGS: {currency} {turnover.cogs.toFixed(2)}
          </p>
          <p className="text-sm text-text-secondary">
            Current inventory value: {currency} {turnover.inventoryValue.toFixed(2)}
          </p>
          <p className="font-display text-xl font-bold text-text-primary">
            {turnover.turnoverRatio != null ? `${turnover.turnoverRatio}×` : "—"}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text-primary">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-text-muted">No delivered orders in this period yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-default text-start text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="py-2 text-start">Product</th>
                  <th className="py-2 text-end">Units</th>
                  <th className="py-2 text-end">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-border-default last:border-0">
                    <td className="py-2 text-text-secondary">{p.name}</td>
                    <td className="py-2 text-end text-text-secondary">{p.quantitySold}</td>
                    <td className="py-2 text-end font-medium text-text-primary">
                      {currency} {p.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
