import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SkipLink } from "@/components/SkipLink";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/server/auth/dal";
import { getCartItemCount } from "@/server/cart/resolve";

export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations("Nav");
  const tSearch = await getTranslations("Search");
  const [user, cartCount] = await Promise.all([getCurrentUser(), getCartItemCount()]);

  return (
    <>
      <SkipLink />
      <AnnouncementBar locale={locale} />
      <header className="border-b border-border-default bg-bg-surface">
        <div className="vm-container flex h-16 items-center gap-4">
          <Link href="/">
            <Logo />
          </Link>

          <form action={`/${locale}/search`} method="GET" className="hidden flex-1 sm:block">
            <input
              type="search"
              name="q"
              placeholder={tSearch("placeholder")}
              className="vm-focus-ring h-10 w-full max-w-md rounded-md border border-border-default bg-bg-page px-3.5 text-sm text-text-primary"
            />
          </form>

          <nav className="ms-auto flex items-center gap-4">
            <Link
              href="/sell"
              className="hidden text-sm font-medium text-text-secondary hover:text-text-primary sm:inline"
            >
              {t("sell")}
            </Link>
            <Link
              href="/cart"
              className="vm-focus-ring relative text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              {t("cart")}
              {cartCount > 0 ? (
                <span className="absolute -end-3 -top-2 flex h-5 w-5 items-center justify-center rounded-pill bg-yellow-400 text-[11px] font-bold text-text-on-yellow">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <LocaleSwitcher />
            {user ? (
              <Button href="/account" variant="secondary" size="sm">
                {t("account")}
              </Button>
            ) : (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  {t("signIn")}
                </Button>
                <Button href="/register" variant="primary" size="sm">
                  {t("createAccount")}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
