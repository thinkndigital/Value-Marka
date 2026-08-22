import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { CurrencyForm } from "@/components/admin/CurrencyForm";
import { listCurrencies } from "@/server/services/currency";
import { updateCurrencyAction } from "@/server/currency/actions";

export default async function EditCurrencyPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.update"))) {
    return <Forbidden />;
  }

  const currencies = await listCurrencies();
  const currency = currencies.find((c) => c.code === code);
  if (!currency) notFound();

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Edit {currency.code}</h1>
      <Card className="max-w-xl">
        <CardBody>
          <CurrencyForm
            action={updateCurrencyAction.bind(null, code)}
            initial={{ name: currency.name, symbol: currency.symbol, decimalDigits: currency.decimalDigits }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
