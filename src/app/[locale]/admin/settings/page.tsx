import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Link } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/Card";

const GROUPS: { title: string; items: { href: string; label: string; description: string }[] }[] = [
  {
    title: "Commerce",
    items: [
      {
        href: "/admin/settings/taxes",
        label: "Taxes",
        description: "Country tax rules used by checkout.",
      },
      {
        href: "/admin/settings/shipping",
        label: "Shipping",
        description: "Zones and methods used by checkout.",
      },
      {
        href: "/admin/settings/currencies",
        label: "Currencies",
        description: "Which currencies are supported platform-wide.",
      },
      {
        href: "/admin/settings/exchange-rates",
        label: "Exchange rates",
        description: "Rate history for cross-currency reporting.",
      },
      {
        href: "/admin/integrations",
        label: "Integrations",
        description: "Stripe, PayPal, email, SMS, storage — real status and connection tests.",
      },
      {
        href: "/admin/coupons",
        label: "Coupons",
        description: "Discount codes and promotions.",
      },
      {
        href: "/admin/payouts",
        label: "Payouts",
        description: "Seller payout requests and approvals.",
      },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        href: "/admin/marketing/flash-sales",
        label: "Flash sales",
        description: "Time-boxed, server-validated discounts on specific products.",
      },
      {
        href: "/admin/affiliates",
        label: "Affiliates",
        description: "Affiliate applications and commission status.",
      },
      {
        href: "/admin/segments",
        label: "Customer segments",
        description: "CRM segments for targeted marketing.",
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        href: "/admin/cms/homepage",
        label: "Homepage",
        description: "Hero, featured sections, banners.",
      },
      {
        href: "/admin/cms/announcement",
        label: "Announcement bar",
        description: "Site-wide banner shown above the header.",
      },
      {
        href: "/admin/cms/popups",
        label: "Popups",
        description: "Scheduled, audience-targeted popup shown once per session.",
      },
      {
        href: "/admin/cms/pages",
        label: "Pages",
        description: "Standalone CMS pages.",
      },
      {
        href: "/admin/cms/navigation",
        label: "Navigation",
        description: "Footer navigation links.",
      },
      {
        href: "/admin/cms/translations",
        label: "Translations",
        description: "Per-locale overrides for category names.",
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        href: "/admin/users",
        label: "Users & roles",
        description: "Grant and revoke platform roles.",
      },
      {
        href: "/admin/sellers",
        label: "Sellers",
        description: "Seller applications and approval.",
      },
      {
        href: "/admin/categories",
        label: "Categories",
        description: "Product category tree.",
      },
      {
        href: "/admin/brands",
        label: "Brands",
        description: "Product brand catalog.",
      },
      {
        href: "/admin/reports",
        label: "Reports",
        description: "Financial reports and CSV export.",
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        description: "Sales, inventory, and campaign metrics.",
      },
    ],
  },
];

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "settings.read"))) {
    return <Forbidden />;
  }

  return (
    <div className="vm-container flex flex-col gap-8 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted">
          Every section below is backed by the real database and services it controls — nothing
          here is decorative.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="h-full hover:bg-bg-sunken">
                  <CardBody>
                    <p className="font-display font-semibold text-text-primary">{item.label}</p>
                    <p className="text-sm text-text-muted">{item.description}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
