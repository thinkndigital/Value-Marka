import { requireUser } from "@/server/auth/guards";
import {
  getAffiliateForUser,
  listAffiliateLinks,
  listAffiliateStats,
} from "@/server/services/affiliates";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApplyAffiliateForm } from "@/components/ApplyAffiliateForm";
import { CreateAffiliateLinkForm } from "@/components/CreateAffiliateLinkForm";

export default async function AccountAffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  const affiliate = await getAffiliateForUser(user.id);

  if (!affiliate) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-text-primary">Affiliate program</h1>
        <p className="text-text-secondary">
          Earn a commission for every order placed by someone you refer.
        </p>
        <ApplyAffiliateForm />
      </div>
    );
  }

  if (affiliate.status !== "APPROVED") {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-text-primary">Affiliate program</h1>
        <Badge variant={affiliate.status === "PENDING" ? "warning" : "danger"}>
          {affiliate.status}
        </Badge>
        <p className="text-text-secondary">
          {affiliate.status === "PENDING"
            ? "Your application is under review."
            : "Your affiliate account is suspended."}
        </p>
      </div>
    );
  }

  const [links, stats] = await Promise.all([
    listAffiliateLinks(affiliate.id),
    listAffiliateStats(affiliate.id),
  ]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Affiliate program</h1>

      <Card>
        <CardBody className="flex justify-around text-center">
          <div>
            <p className="font-display text-xl font-bold text-text-primary">{stats.clicks}</p>
            <p className="text-sm text-text-muted">Clicks</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-text-primary">{stats.conversions}</p>
            <p className="text-sm text-text-muted">Conversions</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-text-primary">
              {stats.totalCommission.toFixed(2)}
            </p>
            <p className="text-sm text-text-muted">Commission earned</p>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-text-primary">Your links</h2>
        {links.length === 0 ? (
          <EmptyState title="No links yet" />
        ) : (
          links.map((link) => (
            <Card key={link.id}>
              <CardBody className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{link.targetUrl}</span>
                <code className="text-text-primary">/api/r/{link.slug}</code>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <CreateAffiliateLinkForm />
    </div>
  );
}
