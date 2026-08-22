import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { FlashSaleForm } from "@/components/admin/FlashSaleForm";
import { createFlashSaleAction } from "@/server/flashSales/actions";

export default async function NewFlashSalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "campaigns.create"))) {
    return <Forbidden />;
  }

  return (
    <div className="vm-container flex max-w-lg flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New flash sale</h1>
      <Card>
        <CardBody>
          <FlashSaleForm action={createFlashSaleAction} />
        </CardBody>
      </Card>
    </div>
  );
}
