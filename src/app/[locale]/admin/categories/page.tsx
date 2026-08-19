import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteCategoryAction } from "@/server/catalog/actions";

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "categories.read"))) {
    return <Forbidden />;
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { children: true, products: true } },
    },
  });

  const canCreate = await hasPermission(user.id, "categories.create");
  const canUpdate = await hasPermission(user.id, "categories.update");
  const canDelete = await hasPermission(user.id, "categories.delete");

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Categories
        </h1>
        {canCreate ? (
          <Button href="/admin/categories/new" variant="primary" size="sm">
            New category
          </Button>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Categories organize the catalog and power navigation."
          action={
            canCreate ? (
              <Button href="/admin/categories/new" variant="primary">
                New category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-start text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Name</th>
                <th className="px-4 py-3 text-start">Slug</th>
                <th className="px-4 py-3 text-start">Parent</th>
                <th className="px-4 py-3 text-start">Products</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{category.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{category.slug}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {category.parent?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{category._count.products}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button
                          href={`/admin/categories/${category.id}`}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <DeleteButton
                          action={deleteCategoryAction.bind(null, category.id)}
                          confirmMessage={`Delete "${category.name}"? This cannot be undone.`}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
