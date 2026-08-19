import "server-only";
import { stringify } from "csv-stringify/sync";
import type { FinancialReport } from "./reports";

/**
 * One consolidated CSV per report (spec §57's line items — gross/net sales,
 * COGS, gross/net profit, commission, tax, shipping, expenses, refunds,
 * discounts, payable balance — as rows of one metric/value export) rather
 * than eight separate single-number files, which would just be this same
 * data split across more downloads.
 */
export function financialReportToCsv(report: FinancialReport): string {
  const rows = [
    { metric: "Gross sales", value: report.grossSales },
    { metric: "Refunds", value: report.refunds },
    { metric: "Discounts", value: report.discounts },
    { metric: "Net sales", value: report.netSales },
    { metric: "COGS", value: report.cogs },
    { metric: "Gross profit", value: report.grossProfit },
    { metric: "Commission", value: report.commission },
    { metric: "Tax collected", value: report.tax },
    { metric: "Shipping remitted", value: report.shipping },
    { metric: "Expenses", value: report.expenses },
    { metric: "Net profit", value: report.netProfit },
    { metric: "Payable balance", value: report.payableBalance },
  ].map((row) => ({ ...row, currency: report.currencyCode }));

  return stringify(rows, { header: true, columns: ["metric", "value", "currency"] });
}
