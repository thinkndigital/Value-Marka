import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { ShippingZoneForm } from "@/components/admin/ShippingZoneForm";
import { createShippingZoneAction } from "@/server/settings/actions";

export default async function NewShippingZonePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.update"))) {
    return <Forbidden />;
  }

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { code: true, name: true },
  });

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New shipping zone</h1>
      <Card className="max-w-xl">
        <CardBody>
          <ShippingZoneForm action={createShippingZoneAction} countries={countries} />
        </CardBody>
      </Card>
    </div>
  );
}
