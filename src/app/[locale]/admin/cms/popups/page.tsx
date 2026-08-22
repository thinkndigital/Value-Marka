import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PopupForm } from "@/components/admin/PopupForm";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { listPopupsForAdmin, type PopupContent } from "@/server/services/cms";
import {
  createPopupAction,
  updatePopupAction,
  togglePopupAction,
  reorderPopupAction,
  deletePopupAction,
} from "@/server/cms/actions";

const AUDIENCE_LABEL: Record<PopupContent["target"], string> = {
  ALL: "Everyone",
  GUEST: "Signed-out visitors",
  CUSTOMER: "Signed-in customers",
};

export default async function AdminPopupsPage({
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

  const popups = await listPopupsForAdmin();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Popups</h1>
        <p className="text-sm text-text-muted">
          Only the single highest-priority (top of this list) popup that is enabled, matches the
          visitor&apos;s audience, and is within its date range shows at a time — and a visitor who
          closes it won&apos;t see it again until their browser session ends. Reorder to change
          priority.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {popups.length === 0 ? (
            <p className="text-sm text-text-muted">No popups yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {popups.map((popup) => {
                const content = popup.content as unknown as PopupContent;
                return (
                  <div key={popup.id} className="rounded-lg border border-border-default p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{content.titleEn}</span>
                        <Badge variant={popup.isActive ? "success" : "neutral"}>
                          {popup.isActive ? "Active" : "Hidden"}
                        </Badge>
                        <Badge variant="neutral">{AUDIENCE_LABEL[content.target]}</Badge>
                      </div>
                      {canUpdate ? (
                        <div className="flex gap-2">
                          <FormActionButton
                            action={reorderPopupAction.bind(null, popup.id, "up")}
                            label="↑"
                            ariaLabel={`Raise priority of "${content.titleEn}"`}
                          />
                          <FormActionButton
                            action={reorderPopupAction.bind(null, popup.id, "down")}
                            label="↓"
                            ariaLabel={`Lower priority of "${content.titleEn}"`}
                          />
                          <FormActionButton
                            action={togglePopupAction.bind(null, popup.id)}
                            label={popup.isActive ? "Hide" : "Show"}
                          />
                          <DeleteButton
                            action={deletePopupAction.bind(null, popup.id)}
                            confirmMessage="Delete this popup?"
                          />
                        </div>
                      ) : null}
                    </div>
                    {canUpdate ? (
                      <PopupForm
                        action={updatePopupAction.bind(null, popup.id)}
                        initial={content}
                        submitLabel="Save popup"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canUpdate ? (
            <div className="border-t border-border-default pt-4">
              <h3 className="mb-3 font-display text-sm font-bold text-text-primary">Add a popup</h3>
              <PopupForm action={createPopupAction} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
