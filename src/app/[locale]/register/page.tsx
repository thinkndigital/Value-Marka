import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { Card, CardBody } from "@/components/ui/Card";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/server/auth/dal";
import { registerAction } from "@/server/auth/actions";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (user) {
    redirect({ href: "/account", locale });
    return null;
  }

  const t = await getTranslations("Auth.Register");
  const boundAction = registerAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg-page px-4 py-16">
      <Logo />
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {t("title")}
            </h1>
            <p className="text-sm text-text-secondary">{t("subtitle")}</p>
          </div>
          <RegisterForm action={boundAction} />
        </CardBody>
      </Card>
    </div>
  );
}
