import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { createCategoryAction } from "@/server/catalog/actions";

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "categories.create"))) {
    return <Forbidden />;
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New category</h1>
      <Card className="max-w-xl">
        <CardBody>
          <CategoryForm action={createCategoryAction} categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}
