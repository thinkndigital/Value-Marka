import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { getPlatformFinancialReport, listCurrenciesWithLedgerActivity } from "@/server/services/reports";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function Row({ label, value, currency, emphasize = false }: { label: string; value: number; currency: string; emphasize?: boolean }) {
  return (
    <div
      className={`flex justify-between ${emphasize ? "border-t border-border-default pt-2 font-display font-bold text-text-primary" : "text-text-secondary"}`}
    >
      <span>{label}</span>
      <span>
        {currency} {value.toFixed(2)}
      </span>
    </div>
  );
}

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ currency?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  const { currency: currencyParam, from, to } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "reports.read"))) {
    return <Forbidden />;
  }

  const currencies = await listCurrenciesWithLedgerActivity("SELLER");
  const currency = currencyParam && currencies.includes(currencyParam) ? currencyParam : currencies[0];

  if (!currency) {
    return (
      <div className="vm-container py-16">
        <EmptyState
          title="No financial activity yet"
          description="Reports appear here once at least one payment has been captured on the platform."
        />
      </div>
    );
  }

  const range = { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined };
  const report = await getPlatformFinancialReport(currency, range);

  return (
    <div className="vm-container flex max-w-xl flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Platform reports</h1>
        <Button
          href={`/api/admin/reports/export?currency=${currency}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
          variant="outline"
          size="sm"
        >
          Download CSV
        </Button>
      </div>

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
          <label htmlFor="from" className="text-sm font-medium text-text-secondary">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-sm font-medium text-text-secondary">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
      </form>

      <Card>
        <CardBody className="flex flex-col gap-2">
          <Row label="Gross sales (all sellers)" value={report.grossSales} currency={currency} />
          <Row label="Refunds" value={report.refunds} currency={currency} />
          <Row label="Discounts" value={report.discounts} currency={currency} />
          <Row label="Net sales" value={report.netSales} currency={currency} emphasize />
          <Row label="COGS (all sellers)" value={-report.cogs} currency={currency} />
          <Row label="Commission revenue" value={report.commission} currency={currency} emphasize />
          <Row label="Tax collected (pending remittance)" value={report.tax} currency={currency} />
          <Row label="Shipping remitted to sellers" value={report.shipping} currency={currency} />
          <Row label="Platform expenses" value={-report.expenses} currency={currency} />
          <Row label="Net profit" value={report.netProfit} currency={currency} emphasize />
        </CardBody>
      </Card>
    </div>
  );
}
