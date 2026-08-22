import { Logo } from "@/components/Logo";
import { Link } from "@/i18n/navigation";
import { SkipLink } from "@/components/SkipLink";
import { requireUser } from "@/server/auth/guards";

const NAV = [
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/sellers", label: "Sellers" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/marketing/flash-sales", label: "Flash Sales" },
  { href: "/admin/marketing/loyalty", label: "Loyalty" },
  { href: "/admin/segments", label: "Segments" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/cms/homepage", label: "Homepage" },
  { href: "/admin/cms/announcement", label: "Announcement" },
  { href: "/admin/cms/popups", label: "Popups" },
  { href: "/admin/cms/pages", label: "Pages" },
  { href: "/admin/cms/navigation", label: "Navigation" },
  { href: "/admin/cms/translations", label: "Translations" },
];

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="border-b border-border-default bg-bg-surface">
        <div className="vm-container flex h-16 items-center gap-8">
          <Link href="/">
            <Logo />
          </Link>
          <span className="rounded-pill bg-navy-600 px-2.5 py-1 text-xs font-semibold text-white">
            Admin
          </span>
          <nav className="flex items-center gap-5 text-sm font-medium text-text-secondary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main-content" className="flex-1 bg-bg-page">{children}</main>
    </div>
  );
}
