import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { ShippingMethodForm } from "@/components/admin/ShippingMethodForm";
import { getShippingMethod } from "@/server/services/settings";
import { updateShippingMethodAction } from "@/server/settings/actions";

export default async function EditShippingMethodPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ zoneId?: string }>;
}) {
  const { locale, id } = await params;
  const { zoneId } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.update"))) {
    return <Forbidden />;
  }

  const method = await getShippingMethod(id);
  if (!method) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Edit shipping method</h1>
      <Card className="max-w-xl">
        <CardBody>
          <ShippingMethodForm
            action={updateShippingMethodAction.bind(null, id, zoneId ?? method.zoneId)}
            zoneId={zoneId ?? method.zoneId}
            initial={{
              name: method.name,
              price: Number(method.price),
              freeThreshold: method.freeThreshold ? Number(method.freeThreshold) : null,
              estimatedDaysMin: method.estimatedDaysMin,
              estimatedDaysMax: method.estimatedDaysMax,
            }}
            submitLabel="Save changes"
          />
        </CardBody>
      </Card>
    </div>
  );
}
