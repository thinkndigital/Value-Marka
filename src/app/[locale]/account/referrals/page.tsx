import { requireUser } from "@/server/auth/guards";
import { getOrCreateReferralCode, listReferralsForUser } from "@/server/services/referrals";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CopyReferralLink } from "@/components/CopyReferralLink";

const STATUS_VARIANT = {
  PENDING: "warning",
  REWARDED: "success",
  EXPIRED: "danger",
} as const;

export default async function AccountReferralsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  const [referralCode, referrals] = await Promise.all([
    getOrCreateReferralCode(user.id),
    listReferralsForUser(user.id),
  ]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Refer a friend</h1>
      <p className="text-text-secondary">
        Share your referral link. When someone you refer places their first order, you earn a
        reward.
      </p>

      <Card>
        <CardBody>
          <CopyReferralLink code={referralCode.code} locale={locale} />
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-text-primary">Your referrals</h2>
        {referrals.length === 0 ? (
          <EmptyState title="No referrals yet" description="Invite friends to see them here." />
        ) : (
          referrals.map((referral) => (
            <Card key={referral.id}>
              <CardBody className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  {referral.referred.firstName} {referral.referred.lastName}
                </span>
                <Badge variant={STATUS_VARIANT[referral.status]}>{referral.status}</Badge>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
