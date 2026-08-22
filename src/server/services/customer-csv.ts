import "server-only";
import { stringify } from "csv-stringify/sync";

const CSV_COLUMNS = [
  "email",
  "firstName",
  "lastName",
  "createdAt",
  "orderCount",
  "lifetimeValue",
  "averageOrderValue",
  "currencyCode",
  "lastOrderAt",
] as const;

export interface CustomerCsvRow {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  orderCount: number;
  lifetimeValue: number;
  averageOrderValue: number;
  currencyCode: string | null;
  lastOrderAt: Date | null;
}

/** Never includes passwordHash or any auth/session data — only what's already shown on the admin customers page. */
export function customersToCsv(rows: CustomerCsvRow[]): string {
  const records = rows.map((row) => ({
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt.toISOString(),
    orderCount: row.orderCount,
    lifetimeValue: row.lifetimeValue,
    averageOrderValue: row.averageOrderValue,
    currencyCode: row.currencyCode ?? "",
    lastOrderAt: row.lastOrderAt ? row.lastOrderAt.toISOString() : "",
  }));
  return stringify(records, { header: true, columns: CSV_COLUMNS });
}
