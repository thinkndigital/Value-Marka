import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { Badge } from "@/components/ui/Badge";
import { getPublishedPostBySlug } from "@/server/services/blog";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  const title = locale === "ar" ? post.titleAr : post.titleEn;
  return {
    title: post.seoTitle ?? `${title} — Value Marka Blog`,
    description: post.seoDescription ?? (locale === "ar" ? post.excerptAr : post.excerptEn) ?? undefined,
    alternates: { canonical: `${appUrl()}/${locale}/blog/${slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const title = locale === "ar" ? post.titleAr : post.titleEn;
  const body = locale === "ar" ? post.bodyAr : post.bodyEn;
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const base = appUrl();
  const postUrl = `${base}/${locale}/blog/${slug}`;

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
          datePublished: post.publishedAt?.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          author: post.author
            ? { "@type": "Person", name: `${post.author.firstName} ${post.author.lastName}` }
            : { "@type": "Organization", name: "Value Marka" },
          publisher: { "@type": "Organization", name: "Value Marka" },
          mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${base}/${locale}` },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/${locale}/blog` },
            { "@type": "ListItem", position: 3, name: title, item: postUrl },
          ],
        }}
      />
      <SiteHeader locale={locale} />
      <main id="main-content" className="flex-1 bg-bg-page">
        <div className="vm-container max-w-3xl py-12">
          <article className="flex flex-col gap-4">
            {post.category ? (
              <Link href={{ pathname: "/blog", query: { category: post.category.slug } }}>
                <Badge variant="brand">{locale === "ar" ? post.category.nameAr : post.category.nameEn}</Badge>
              </Link>
            ) : null}
            <h1 className="font-display text-3xl font-bold text-text-primary">{title}</h1>
            {post.publishedAt ? (
              <p className="text-sm text-text-muted">
                {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(post.publishedAt)}
              </p>
            ) : null}
            {post.coverImageUrl ? (
              <div className="aspect-video overflow-hidden rounded-lg bg-bg-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.coverImageUrl} alt={title} className="h-full w-full object-cover" />
              </div>
            ) : null}
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-text-secondary">
                {paragraph}
              </p>
            ))}
            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-border-default pt-4">
                {post.tags.map(({ tag }) => (
                  <Badge key={tag.id} variant="neutral">
                    {locale === "ar" ? tag.nameAr : tag.nameEn}
                  </Badge>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
