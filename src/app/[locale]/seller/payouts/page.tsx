import { requireApprovedSeller } from "@/server/auth/seller-guard";
import {
  getSellerAvailableBalance,
  listPayoutsForSeller,
  listSellerCurrencies,
} from "@/server/services/payouts";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PayoutRequestForm } from "@/components/PayoutRequestForm";

const STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "info",
  PROCESSING: "info",
  PAID: "success",
  REJECTED: "danger",
  ON_HOLD: "neutral",
} as const;

export default async function SellerPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const currencies = await listSellerCurrencies(seller.id);
  const [balances, payouts] = await Promise.all([
    Promise.all(
      currencies.map(async (currencyCode) => ({
        currencyCode,
        available: await getSellerAvailableBalance(seller.id, currencyCode),
      })),
    ),
    listPayoutsForSeller(seller.id),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Payouts</h1>

      {balances.length === 0 ? (
        <EmptyState
          title="No balance yet"
          description="Balances appear here once a customer's payment is captured for one of your orders."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {balances.map((balance) => (
            <PayoutRequestForm
              key={balance.currencyCode}
              currencyCode={balance.currencyCode}
              available={balance.available}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold text-text-primary">History</h2>
        {payouts.length === 0 ? (
          <EmptyState title="No payout requests yet" />
        ) : (
          payouts.map((payout) => (
            <Card key={payout.id}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-text-primary">
                    {payout.currencyCode} {payout.amount.toString()}
                  </p>
                  <p className="text-sm text-text-muted">
                    {payout.method} ·{" "}
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(payout.requestedAt)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[payout.status]}>{payout.status.replaceAll("_", " ")}</Badge>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
