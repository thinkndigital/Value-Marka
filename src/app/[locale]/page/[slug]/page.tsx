import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getPublishedCmsPage } from "@/server/services/cms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPublishedCmsPage(slug, locale);
  if (!page) return {};
  return {
    title: page.seoTitle ?? undefined,
    description: page.seoDescription ?? undefined,
  };
}

export default async function CmsPageRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const page = await getPublishedCmsPage(slug, locale);
  if (!page) notFound();

  const paragraphs = page.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />
      <main className="flex-1 bg-bg-page">
        <div className="vm-container max-w-3xl py-12">
          <article className="flex flex-col gap-4">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-text-secondary">
                {paragraph}
              </p>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
