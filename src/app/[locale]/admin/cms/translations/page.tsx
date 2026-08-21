import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TranslationForm } from "@/components/admin/TranslationForm";
import { prisma } from "@/server/db";
import { routing } from "@/i18n/routing";
import { listTranslations } from "@/server/services/translations";
import { deleteTranslationAction } from "@/server/translations/actions";

export default async function AdminTranslationsPage({
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

  const [translations, categories] = await Promise.all([
    listTranslations("Category"),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Translations</h1>
      <p className="text-sm text-text-secondary">
        Override a category&apos;s display name per locale without changing its base record.
      </p>

      {canUpdate ? (
        <Card>
          <CardBody>
            <TranslationForm categories={categories} locales={routing.locales} />
          </CardBody>
        </Card>
      ) : null}

      {translations.length === 0 ? (
        <EmptyState title="No translations yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Category</th>
                <th className="px-4 py-3 text-start">Locale</th>
                <th className="px-4 py-3 text-start">Translated name</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {translations.map((translation) => (
                <tr key={translation.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 text-text-secondary">
                    {categoryNameById.get(translation.entityId) ?? translation.entityId}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{translation.locale.toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{translation.value}</td>
                  <td className="px-4 py-3 text-end">
                    {canUpdate ? (
                      <DeleteButton
                        action={deleteTranslationAction.bind(null, translation.id)}
                        confirmMessage="Delete this translation?"
                      />
                    ) : null}
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
