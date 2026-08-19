import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteBrandAction } from "@/server/catalog/actions";

export default async function AdminBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "brands.read"))) {
    return <Forbidden />;
  }

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const canCreate = await hasPermission(user.id, "brands.create");
  const canUpdate = await hasPermission(user.id, "brands.update");
  const canDelete = await hasPermission(user.id, "brands.delete");

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Brands</h1>
        {canCreate ? (
          <Button href="/admin/brands/new" variant="primary" size="sm">
            New brand
          </Button>
        ) : null}
      </div>

      {brands.length === 0 ? (
        <EmptyState
          title="No brands yet"
          description="Brands help customers filter and discover products."
          action={
            canCreate ? (
              <Button href="/admin/brands/new" variant="primary">
                New brand
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
                <th className="px-4 py-3 text-start">Slug</th>
                <th className="px-4 py-3 text-start">Products</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{brand.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{brand.slug}</td>
                  <td className="px-4 py-3 text-text-secondary">{brand._count.products}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button href={`/admin/brands/${brand.id}`} variant="outline" size="sm">
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <DeleteButton
                          action={deleteBrandAction.bind(null, brand.id)}
                          confirmMessage={`Delete "${brand.name}"? This cannot be undone.`}
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
