import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { TaxRuleForm } from "@/components/admin/TaxRuleForm";
import { getTaxRule } from "@/server/services/settings";
import { updateTaxRuleAction } from "@/server/settings/actions";

export default async function EditTaxRulePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.update"))) {
    return <Forbidden />;
  }

  const [rule, countries] = await Promise.all([
    getTaxRule(id),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);
  if (!rule) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Edit tax rule</h1>
      <Card className="max-w-xl">
        <CardBody>
          <TaxRuleForm
            action={updateTaxRuleAction.bind(null, id)}
            countries={countries}
            initial={{
              countryCode: rule.countryCode,
              name: rule.name,
              ratePercent: Number(rule.rate) * 100,
              appliesTo: rule.appliesTo,
            }}
            submitLabel="Save changes"
          />
        </CardBody>
      </Card>
    </div>
  );
}
