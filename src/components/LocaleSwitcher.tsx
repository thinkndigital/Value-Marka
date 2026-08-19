"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<string, string> = {
  en: "English",
  ar: "العربية",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="vm-focus-ring inline-flex items-center gap-2 rounded-md text-sm text-text-secondary">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value });
        }}
        className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-2 py-1.5 text-sm text-text-primary"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {labels[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  );
}
