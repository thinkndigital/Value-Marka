import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { listAnnouncementsForAdmin, type AnnouncementContent } from "@/server/services/cms";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  toggleAnnouncementAction,
  reorderAnnouncementAction,
  deleteAnnouncementAction,
} from "@/server/cms/actions";

export default async function AdminAnnouncementPage({
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

  const announcements = await listAnnouncementsForAdmin();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Announcement bar</h1>
        <p className="text-sm text-text-muted">
          The storefront shows the highest-priority (top of this list) announcement that is
          enabled and within its date range right now. Reorder to change priority.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {announcements.length === 0 ? (
            <p className="text-sm text-text-muted">No announcements yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {announcements.map((announcement) => {
                const content = announcement.content as unknown as AnnouncementContent;
                return (
                  <div key={announcement.id} className="rounded-lg border border-border-default p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{content.textEn}</span>
                        <Badge variant={announcement.isActive ? "success" : "neutral"}>
                          {announcement.isActive ? "Active" : "Hidden"}
                        </Badge>
                      </div>
                      {canUpdate ? (
                        <div className="flex gap-2">
                          <FormActionButton
                            action={reorderAnnouncementAction.bind(null, announcement.id, "up")}
                            label="↑"
                            ariaLabel={`Raise priority of "${content.textEn}"`}
                          />
                          <FormActionButton
                            action={reorderAnnouncementAction.bind(null, announcement.id, "down")}
                            label="↓"
                            ariaLabel={`Lower priority of "${content.textEn}"`}
                          />
                          <FormActionButton
                            action={toggleAnnouncementAction.bind(null, announcement.id)}
                            label={announcement.isActive ? "Hide" : "Show"}
                          />
                          <DeleteButton
                            action={deleteAnnouncementAction.bind(null, announcement.id)}
                            confirmMessage="Delete this announcement?"
                          />
                        </div>
                      ) : null}
                    </div>
                    {canUpdate ? (
                      <AnnouncementForm
                        action={updateAnnouncementAction.bind(null, announcement.id)}
                        initial={content}
                        submitLabel="Save announcement"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canUpdate ? (
            <div className="border-t border-border-default pt-4">
              <h3 className="mb-3 font-display text-sm font-bold text-text-primary">
                Add an announcement
              </h3>
              <AnnouncementForm action={createAnnouncementAction} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
