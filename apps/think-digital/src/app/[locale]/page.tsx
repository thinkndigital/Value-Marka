import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/navigation/Wordmark";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";

// Holding page until Phase 5 (landing page) replaces it.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Holding");
  const common = await getTranslations("Common");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-site flex h-[var(--header-h)] items-center justify-between">
        <Wordmark label={common("home")} />
        <LanguageSwitcher />
      </header>
      <main id="main" className="container-site flex flex-1 flex-col justify-center gap-8 py-16">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="max-w-5xl text-display">{t("title")}</h1>
        <p className="max-w-2xl text-body-lg text-fg-muted">{t("lead")}</p>
        <div>
          <Button href="/style-guide" icon={<ArrowRight className="flip-rtl size-4" />}>
            {t("styleGuide")}
          </Button>
        </div>
      </main>
    </div>
  );
}
