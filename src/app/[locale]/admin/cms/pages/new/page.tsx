import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { CmsPageForm } from "@/components/admin/CmsPageForm";
import { createCmsPageAction } from "@/server/cms/actions";

export default async function NewCmsPagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.update"))) {
    return <Forbidden />;
  }

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New page</h1>
      <Card className="max-w-2xl">
        <CardBody>
          <CmsPageForm action={createCmsPageAction.bind(null, locale)} showSlug submitLabel="Create page" />
        </CardBody>
      </Card>
    </div>
  );
}
