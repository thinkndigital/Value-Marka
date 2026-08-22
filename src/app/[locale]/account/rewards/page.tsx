import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RedeemPointsForm } from "@/components/RedeemPointsForm";
import { requireUser } from "@/server/auth/guards";
import {
  getLoyaltyAccount,
  listLoyaltyTransactions,
  getEffectiveRewardRule,
} from "@/server/services/loyalty";

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  const [account, transactions, rule] = await Promise.all([
    getLoyaltyAccount(user.id),
    listLoyaltyTransactions(user.id),
    getEffectiveRewardRule(),
  ]);
  const balance = account?.balance ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Rewards</h1>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-text-muted">Your balance</p>
            <p className="font-display text-3xl font-extrabold text-text-primary">{balance} pts</p>
            {rule ? (
              <p className="text-sm text-text-muted">
                Earn {Number(rule.pointsPerCurrencyUnit)} point(s) per unit spent · redeem at{" "}
                {Number(rule.redemptionValue)} per point
              </p>
            ) : (
              <p className="text-sm text-text-muted">Rewards aren&apos;t configured yet.</p>
            )}
          </div>

          {rule ? <RedeemPointsForm balance={balance} /> : null}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-text-primary">History</h2>
        {transactions.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="You'll see points appear here after an order is delivered."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">Date</th>
                  <th className="px-4 py-3 text-start">Type</th>
                  <th className="px-4 py-3 text-start">Points</th>
                  <th className="px-4 py-3 text-start">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3 text-text-secondary">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(txn.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={txn.type === "EARNED" ? "success" : "neutral"}>{txn.type}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {txn.points > 0 ? `+${txn.points}` : txn.points}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{txn.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
