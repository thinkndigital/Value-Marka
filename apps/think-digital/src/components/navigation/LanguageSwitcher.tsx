"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/Button";

const LABELS = { ar: { name: "العربية", lang: "ar" }, en: { name: "English", lang: "en" } } as const;

/** Switches to the other locale on the same path; label is in the target language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const target = locale === "ar" ? "en" : "ar";

  return (
    <Link href={pathname} locale={target} hrefLang={target} className={buttonClasses("ghost", "sm", className)}>
      <Languages aria-hidden className="size-4" />
      <span lang={LABELS[target].lang}>{LABELS[target].name}</span>
    </Link>
  );
}
