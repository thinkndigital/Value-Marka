import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { listShippingZones } from "@/server/services/settings";
import { deleteShippingZoneAction } from "@/server/settings/actions";

export default async function AdminShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.read"))) {
    return <Forbidden />;
  }

  const canUpdate = await hasPermission(user.id, "settings.update");
  const zones = await listShippingZones();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Shipping</h1>
          <p className="text-sm text-text-muted">
            Checkout picks the cheapest active platform-wide method for the order&apos;s country —
            changes here take effect on the next order placed.
          </p>
        </div>
        {canUpdate ? (
          <Button href="/admin/settings/shipping/zones/new" variant="primary" size="sm">
            New zone
          </Button>
        ) : null}
      </div>

      {zones.length === 0 ? (
        <EmptyState
          title="No shipping zones yet"
          description="Without a zone and method, checkout charges no shipping for that country."
          action={
            canUpdate ? (
              <Button href="/admin/settings/shipping/zones/new" variant="primary">
                New zone
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-text-primary">{zone.name}</p>
                  <p className="text-sm text-text-muted">{zone.country.name}</p>
                </div>
                {canUpdate ? (
                  <div className="flex gap-2">
                    <Button href={`/admin/settings/shipping/zones/${zone.id}`} variant="outline" size="sm">
                      Manage methods
                    </Button>
                    <DeleteButton
                      action={deleteShippingZoneAction.bind(null, zone.id)}
                      confirmMessage={`Delete zone "${zone.name}"? It must have no methods left.`}
                    />
                  </div>
                ) : null}
              </CardHeader>
              <CardBody>
                {zone.methods.length === 0 ? (
                  <p className="text-sm text-text-muted">No shipping methods in this zone.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {zone.methods.map((method) => (
                      <li key={method.id} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary">{method.name}</span>
                        <span className="flex items-center gap-2 text-text-secondary">
                          {Number(method.price).toFixed(2)}
                          <Badge variant={method.isActive ? "success" : "neutral"}>
                            {method.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
