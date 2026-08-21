import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { NavItemForm } from "@/components/admin/NavItemForm";
import { getFooterNavItems } from "@/server/services/navigation";
import {
  createFooterNavItemAction,
  updateFooterNavItemAction,
  reorderFooterNavItemAction,
  deleteFooterNavItemAction,
} from "@/server/navigation/actions";

export default async function AdminNavigationPage({
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

  const items = await getFooterNavItems();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Footer navigation</h1>
      <p className="text-sm text-text-secondary">
        These links appear in the site footer, in this order.
      </p>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">No footer links yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default p-3"
                >
                  {canUpdate ? (
                    <NavItemForm
                      action={updateFooterNavItemAction.bind(null, item.id)}
                      initial={{ label: item.label, url: item.url }}
                      submitLabel="Save"
                    />
                  ) : (
                    <span className="text-sm text-text-secondary">
                      {item.label} → {item.url}
                    </span>
                  )}
                  {canUpdate ? (
                    <div className="flex gap-2">
                      <FormActionButton
                        action={reorderFooterNavItemAction.bind(null, item.id, "up")}
                        label="↑"
                      />
                      <FormActionButton
                        action={reorderFooterNavItemAction.bind(null, item.id, "down")}
                        label="↓"
                      />
                      <DeleteButton
                        action={deleteFooterNavItemAction.bind(null, item.id)}
                        confirmMessage={`Remove "${item.label}" from the footer?`}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {canUpdate ? (
            <div className="border-t border-border-default pt-4">
              <h2 className="mb-3 font-display text-sm font-bold text-text-primary">Add a link</h2>
              <NavItemForm action={createFooterNavItemAction} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
