import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/server/auth/dal";

export default async function HomePage() {
  const t = await getTranslations("Home");
  const tNav = await getTranslations("Nav");
  const tFooter = await getTranslations("Footer");
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-default bg-bg-surface">
        <div className="vm-container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4">
            <LocaleSwitcher />
            {user ? (
              <Button href="/account" variant="secondary" size="sm">
                {tNav("account")}
              </Button>
            ) : (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  {tNav("signIn")}
                </Button>
                <Button href="/register" variant="primary" size="sm">
                  {tNav("createAccount")}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="vm-container flex flex-col items-start gap-6 py-24">
          <Badge variant="brand">{t("kicker")}</Badge>
          <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-tight text-text-primary sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-lg text-text-secondary">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/register" variant="primary" size="lg">
              {t("ctaPrimary")}
            </Button>
            <Button href="/login" variant="outline" size="lg">
              {t("ctaSecondary")}
            </Button>
          </div>

          <div className="mt-8 flex max-w-xl flex-col gap-2 rounded-lg border border-border-default bg-bg-surface p-5">
            <Badge variant="neutral">{t("statusLabel")}</Badge>
            <p className="text-sm text-text-secondary">{t("statusNote")}</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border-default bg-bg-surface py-6">
        <div className="vm-container flex items-center justify-between text-sm text-text-muted">
          <span>{tFooter("rights", { year: new Date().getFullYear() })}</span>
          <Link href="/style-guide" className="hover:text-text-primary">
            {tNav("styleGuide")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
