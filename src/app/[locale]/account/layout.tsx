import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { requireUser } from "@/server/auth/guards";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);
  const t = await getTranslations("Account");

  const NAV = [
    { href: "/account", label: t("navOverview") },
    { href: "/account/orders", label: t("navOrders") },
    { href: "/account/addresses", label: t("navAddresses") },
    { href: "/account/wishlist", label: t("navWishlist") },
    { href: "/account/reviews", label: t("navReviews") },
    { href: "/account/affiliate", label: t("navAffiliate") },
    { href: "/account/referrals", label: t("navReferrals") },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />
      <main className="flex-1 bg-bg-page">
        <div className="vm-container flex flex-col gap-8 py-10 md:flex-row">
          <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-48 md:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="vm-focus-ring whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-sunken hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
