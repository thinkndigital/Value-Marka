import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { updateCategoryAction } from "@/server/catalog/actions";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "categories.update"))) {
    return <Forbidden />;
  }

  const [category, categories] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findMany({
      where: { id: { not: id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!category) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        Edit category
      </h1>
      <Card className="max-w-xl">
        <CardBody>
          <CategoryForm
            action={updateCategoryAction.bind(null, id)}
            categories={categories}
            initial={{
              name: category.name,
              slug: category.slug,
              parentId: category.parentId,
              sortOrder: category.sortOrder,
              imageUrl: category.imageUrl,
            }}
            submitLabel="Save changes"
          />
        </CardBody>
      </Card>
    </div>
  );
}
