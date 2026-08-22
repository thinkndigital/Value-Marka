import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TestConnectionButton } from "@/components/admin/TestConnectionButton";
import { getIntegrationsOverview } from "@/server/services/integrations";
import {
  testStripeConnectionAction,
  testPaypalConnectionAction,
  testEmailConnectionAction,
  testSmsConnectionAction,
  testStorageConnectionAction,
} from "@/server/integrations/actions";

const TEST_ACTIONS: Record<string, typeof testStripeConnectionAction> = {
  stripe: testStripeConnectionAction,
  paypal: testPaypalConnectionAction,
  email: testEmailConnectionAction,
  sms: testSmsConnectionAction,
  storage: testStorageConnectionAction,
};

export default async function AdminIntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.read"))) {
    return <Forbidden />;
  }

  const canTest = await hasPermission(user.id, "settings.update");
  const integrations = await getIntegrationsOverview();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Integrations</h1>
        <p className="text-sm text-text-muted">
          Real status for every external provider this app talks to — configuration presence from
          the actual environment, activity from the actual database, and a live connection test on
          demand. Credentials are never shown, only whether they&apos;re set.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.key}>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-text-primary">{integration.name}</h2>
              <Badge variant={integration.configured ? "success" : "neutral"}>
                {integration.configured ? "Configured" : "Not configured"}
              </Badge>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1 text-sm">
                {integration.envVars.map((v) => (
                  <li key={v.name} className="flex items-center justify-between text-text-secondary">
                    <span className="font-mono text-xs">{v.name}</span>
                    <Badge variant={v.configured ? "success" : "danger"}>
                      {v.configured ? "Set" : "Missing"}
                    </Badge>
                  </li>
                ))}
              </ul>

              {integration.lastActivity ? (
                <p className="text-xs text-text-muted">
                  <span className="font-semibold">{integration.lastActivity.label}:</span>{" "}
                  {integration.lastActivity.detail}
                </p>
              ) : null}

              {canTest ? (
                <div className="flex justify-end">
                  <TestConnectionButton action={TEST_ACTIONS[integration.key]} />
                </div>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
