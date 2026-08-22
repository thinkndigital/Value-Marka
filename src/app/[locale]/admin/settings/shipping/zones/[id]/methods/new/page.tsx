import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { ShippingMethodForm } from "@/components/admin/ShippingMethodForm";
import { getShippingZone } from "@/server/services/settings";
import { createShippingMethodAction } from "@/server/settings/actions";

export default async function NewShippingMethodPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.update"))) {
    return <Forbidden />;
  }

  const zone = await getShippingZone(id);
  if (!zone) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        New shipping method — {zone.name}
      </h1>
      <Card className="max-w-xl">
        <CardBody>
          <ShippingMethodForm action={createShippingMethodAction.bind(null, id)} zoneId={id} />
        </CardBody>
      </Card>
    </div>
  );
}
