import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { BrandForm } from "@/components/admin/BrandForm";
import { updateBrandAction } from "@/server/catalog/actions";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "brands.update"))) {
    return <Forbidden />;
  }

  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Edit brand</h1>
      <Card className="max-w-xl">
        <CardBody>
          <BrandForm
            action={updateBrandAction.bind(null, id)}
            initial={{ name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl }}
            submitLabel="Save changes"
          />
        </CardBody>
      </Card>
    </div>
  );
}
