import { Logo } from "@/components/Logo";
import { Link } from "@/i18n/navigation";
import { requireApprovedSeller } from "@/server/auth/seller-guard";

const NAV = [
  { href: "/seller", label: "Overview" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/warehouses", label: "Warehouses" },
  { href: "/seller/suppliers", label: "Suppliers" },
  { href: "/seller/purchase-orders", label: "Purchase orders" },
  { href: "/seller/expenses", label: "Expenses" },
  { href: "/seller/reports", label: "Reports" },
  { href: "/seller/payouts", label: "Payouts" },
];

export default async function SellerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-default bg-bg-surface">
        <div className="vm-container flex h-16 items-center gap-8">
          <Link href="/">
            <Logo />
          </Link>
          <span className="rounded-pill bg-yellow-400 px-2.5 py-1 text-xs font-semibold text-text-on-yellow">
            {seller.storeName}
          </span>
          <nav className="flex items-center gap-5 text-sm font-medium text-text-secondary">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-text-primary">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href={`/store/${seller.storeSlug}`}
            className="ms-auto text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            View store
          </Link>
        </div>
      </header>
      <main className="flex-1 bg-bg-page">{children}</main>
    </div>
  );
}
