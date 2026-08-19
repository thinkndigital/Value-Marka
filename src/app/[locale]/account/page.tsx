import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/server/auth/dal";
import { logoutAction } from "@/server/auth/actions";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return;
  }

  const t = await getTranslations("Account");
  const boundLogout = logoutAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-bg-page px-4 py-16">
      <Logo />
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col gap-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {t("title")}
            </h1>
            <p className="text-text-secondary">
              {t("welcomeBack", { firstName: user.firstName })}
            </p>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between border-b border-border-default pb-3">
              <dt className="text-text-muted">{t("email")}</dt>
              <dd className="font-medium text-text-primary">{user.email}</dd>
            </div>
          </dl>
          <p className="text-sm text-text-muted">
            {t("memberSince", {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
              }).format(user.createdAt),
            })}
          </p>

          <div className="flex flex-wrap gap-2">
            {user.roles.map((r) => (
              <Badge key={r.role.key} variant="neutral">
                {r.role.name}
              </Badge>
            ))}
          </div>

          <form action={boundLogout}>
            <Button type="submit" variant="outline" className="w-full">
              {t("signOut")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
