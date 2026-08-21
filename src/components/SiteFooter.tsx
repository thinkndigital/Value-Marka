import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getFooterNavItems } from "@/server/services/navigation";

export async function SiteFooter() {
  const tFooter = await getTranslations("Footer");
  const tNav = await getTranslations("Nav");
  const footerItems = await getFooterNavItems();

  return (
    <footer className="border-t border-border-default bg-bg-surface py-6">
      <div className="vm-container flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted">
        <span>{tFooter("rights", { year: new Date().getFullYear() })}</span>
        <nav className="flex flex-wrap gap-4">
          {footerItems.map((item) => (
            <Link key={item.id} href={item.url} className="hover:text-text-primary">
              {item.label}
            </Link>
          ))}
          <Link href="/style-guide" className="hover:text-text-primary">
            {tNav("styleGuide")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
