import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { getShippingZone } from "@/server/services/settings";
import { deleteShippingMethodAction, toggleShippingMethodAction } from "@/server/settings/actions";

export default async function ShippingZoneDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.read"))) {
    return <Forbidden />;
  }

  const canUpdate = await hasPermission(user.id, "settings.update");
  const zone = await getShippingZone(id);
  if (!zone) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">{zone.name}</h1>
        {canUpdate ? (
          <Button href={`/admin/settings/shipping/zones/${zone.id}/methods/new`} variant="primary" size="sm">
            New method
          </Button>
        ) : null}
      </div>

      {zone.methods.length === 0 ? (
        <EmptyState
          title="No shipping methods yet"
          action={
            canUpdate ? (
              <Button href={`/admin/settings/shipping/zones/${zone.id}/methods/new`} variant="primary">
                New method
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Name</th>
                <th className="px-4 py-3 text-start">Price</th>
                <th className="px-4 py-3 text-start">Free above</th>
                <th className="px-4 py-3 text-start">Est. days</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zone.methods.map((method) => (
                <tr key={method.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{method.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{Number(method.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {method.freeThreshold ? Number(method.freeThreshold).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {method.estimatedDaysMin ?? "—"}–{method.estimatedDaysMax ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={method.isActive ? "success" : "neutral"}>
                      {method.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <>
                          <FormActionButton
                            action={toggleShippingMethodAction.bind(null, method.id, zone.id)}
                            label={method.isActive ? "Disable" : "Enable"}
                            variant="outline"
                          />
                          <Button
                            href={`/admin/settings/shipping/methods/${method.id}?zoneId=${zone.id}`}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </Button>
                          <DeleteButton
                            action={deleteShippingMethodAction.bind(null, method.id, zone.id)}
                            confirmMessage={`Delete "${method.name}"? This cannot be undone.`}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <CardFooterNote />
    </div>
  );
}

function CardFooterNote() {
  return (
    <Card>
      <CardBody className="text-sm text-text-muted">
        Only platform-wide methods (no specific seller) are shown here — those are what checkout
        actually uses for the shipping cost split across a multi-seller order.
      </CardBody>
    </Card>
  );
}
