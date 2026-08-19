import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { BrandForm } from "@/components/admin/BrandForm";
import { createBrandAction } from "@/server/catalog/actions";

export default async function NewBrandPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "brands.create"))) {
    return <Forbidden />;
  }

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New brand</h1>
      <Card className="max-w-xl">
        <CardBody>
          <BrandForm action={createBrandAction} />
        </CardBody>
      </Card>
    </div>
  );
}
