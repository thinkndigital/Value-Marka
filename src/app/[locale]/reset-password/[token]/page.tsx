import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { Card, CardBody } from "@/components/ui/Card";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Auth.ResetPassword");

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
          <ResetPasswordForm token={token} />
        </CardBody>
      </Card>
    </div>
  );
}
