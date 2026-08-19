import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const tFooter = await getTranslations("Footer");
  const tNav = await getTranslations("Nav");

  return (
    <footer className="border-t border-border-default bg-bg-surface py-6">
      <div className="vm-container flex items-center justify-between text-sm text-text-muted">
        <span>{tFooter("rights", { year: new Date().getFullYear() })}</span>
        <Link href="/style-guide" className="hover:text-text-primary">
          {tNav("styleGuide")}
        </Link>
      </div>
    </footer>
  );
}
