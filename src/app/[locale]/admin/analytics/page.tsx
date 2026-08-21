import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SalesTrendChart } from "@/components/admin/SalesTrendChart";
import { listCurrenciesWithLedgerActivity } from "@/server/services/reports";
import {
  getSalesTrend,
  getInventoryTurnover,
  getSellerGmvLeaderboard,
  getCouponPerformance,
  getAffiliatePerformance,
  daysAgoRange,
} from "@/server/services/analytics";

const DAY_OPTIONS = [7, 30, 90];

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ currency?: string; days?: string }>;
}) {
  const { locale } = await params;
  const { currency: currencyParam, days: daysParam } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "reports.read"))) {
    return <Forbidden />;
  }

  const currencies = await listCurrenciesWithLedgerActivity("SELLER");
  const currency = currencyParam && currencies.includes(currencyParam) ? currencyParam : currencies[0];
  const days = DAY_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  if (!currency) {
    return (
      <div className="vm-container py-16">
        <EmptyState
          title="No sales activity yet"
          description="Analytics appear here once at least one payment has been captured on the platform."
        />
      </div>
    );
  }

  const range = daysAgoRange(days);

  const [trend, turnover, leaderboard, couponPerf, affiliatePerf] = await Promise.all([
    getSalesTrend(currency, days),
    getInventoryTurnover(currency, range),
    getSellerGmvLeaderboard(currency, range),
    getCouponPerformance(currency, range),
    getAffiliatePerformance(currency, range),
  ]);

  return (
    <div className="vm-container flex max-w-4xl flex-col gap-6 py-10">
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

      <div className="grid gap-6 md:grid-cols-2">
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
            <p className="text-xs text-text-muted">
              Ratio of period COGS to current stock value — an approximation, since historical
              inventory value isn&apos;t tracked.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold text-text-primary">Marketing performance</h2>
            <div className="text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Coupons</p>
              <p>
                {couponPerf.redemptions} redemptions · {currency} {couponPerf.totalDiscount.toFixed(2)}{" "}
                discounted · {currency} {couponPerf.orderRevenue.toFixed(2)} in order revenue
              </p>
            </div>
            <div className="text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Affiliates</p>
              <p>
                {affiliatePerf.conversions} conversions · {currency} {affiliatePerf.commissionPaid.toFixed(2)}{" "}
                commission paid · {currency} {affiliatePerf.orderRevenue.toFixed(2)} in order revenue
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text-primary">Top sellers by GMV</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-text-muted">No seller sales in this period yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-default text-start text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="py-2 text-start">Seller</th>
                  <th className="py-2 text-end">GMV</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.sellerId} className="border-b border-border-default last:border-0">
                    <td className="py-2 text-text-secondary">{entry.storeName}</td>
                    <td className="py-2 text-end font-medium text-text-primary">
                      {currency} {entry.gmv.toFixed(2)}
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
