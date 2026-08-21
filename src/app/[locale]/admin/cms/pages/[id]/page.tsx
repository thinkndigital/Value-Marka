import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Card, CardBody } from "@/components/ui/Card";
import { CmsPageForm } from "@/components/admin/CmsPageForm";
import { getCmsPageForAdmin } from "@/server/services/cms";
import { updateCmsPageAction } from "@/server/cms/actions";

export default async function EditCmsPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editLocale?: string }>;
}) {
  const { locale, id } = await params;
  const { editLocale: requestedLocale } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.update"))) {
    return <Forbidden />;
  }

  const editLocale = routing.locales.includes(requestedLocale as (typeof routing.locales)[number])
    ? (requestedLocale as string)
    : locale;

  const page = await getCmsPageForAdmin(id, editLocale);
  if (!page) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Edit page: /{page.slug}</h1>
        <div className="flex gap-2">
          {routing.locales.map((l) => (
            <Link
              key={l}
              href={{ pathname: `/admin/cms/pages/${id}`, query: { editLocale: l } }}
              className={`vm-focus-ring rounded-md border px-3 py-1.5 text-sm font-medium ${
                l === editLocale
                  ? "border-navy-600 bg-navy-600 text-white"
                  : "border-border-default text-text-secondary hover:bg-bg-sunken"
              }`}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
      <Card className="max-w-2xl">
        <CardBody>
          <CmsPageForm
            action={updateCmsPageAction.bind(null, id, editLocale)}
            initial={{
              seoTitle: page.seoTitle ?? undefined,
              seoDescription: page.seoDescription ?? undefined,
              body: page.body,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
