import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { listCmsPages } from "@/server/services/cms";
import { setCmsPageStatusAction, deleteCmsPageAction } from "@/server/cms/actions";

export default async function AdminCmsPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.read"))) {
    return <Forbidden />;
  }
  const canUpdate = await hasPermission(user.id, "cms.update");
  const canDelete = await hasPermission(user.id, "cms.delete");

  const pages = await listCmsPages();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Landing pages</h1>
        {canUpdate ? (
          <Button href="/admin/cms/pages/new" variant="primary" size="sm">
            New page
          </Button>
        ) : null}
      </div>

      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Create landing pages like About Us or Terms of Service."
          action={
            canUpdate ? (
              <Button href="/admin/cms/pages/new" variant="primary">
                New page
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Slug</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">/page/{page.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={page.status === "PUBLISHED" ? "success" : "neutral"}>
                      {page.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <>
                          <Button href={`/admin/cms/pages/${page.id}`} variant="outline" size="sm">
                            Edit
                          </Button>
                          <FormActionButton
                            action={setCmsPageStatusAction.bind(
                              null,
                              page.id,
                              page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                            )}
                            label={page.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          />
                        </>
                      ) : null}
                      {canDelete ? (
                        <DeleteButton
                          action={deleteCmsPageAction.bind(null, page.id)}
                          confirmMessage={`Delete "${page.slug}"? This cannot be undone.`}
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
