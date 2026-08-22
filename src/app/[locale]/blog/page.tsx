import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/ui/EmptyState";
import { listPublishedPosts } from "@/server/services/blog";
import { parsePage } from "@/server/pagination";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Blog — Value Marka",
    alternates: { canonical: `${appUrl()}/${locale}/blog` },
  };
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { items, totalPages } = await listPublishedPosts(page, sp.category);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />
      <main id="main-content" className="flex-1 bg-bg-page">
        <div className="vm-container flex flex-col gap-8 py-12">
          <h1 className="font-display text-3xl font-bold text-text-primary">Blog</h1>

          {items.length === 0 ? (
            <EmptyState title="No posts yet" description="Check back soon." />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((post) => {
                const title = locale === "ar" ? post.titleAr : post.titleEn;
                const excerpt = locale === "ar" ? post.excerptAr : post.excerptEn;
                return (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="vm-focus-ring flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-video bg-bg-sunken">
                      {post.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.coverImageUrl} alt={title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                      {post.category ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {locale === "ar" ? post.category.nameAr : post.category.nameEn}
                        </span>
                      ) : null}
                      <h2 className="font-display text-lg font-bold text-text-primary">{title}</h2>
                      {excerpt ? <p className="line-clamp-3 text-sm text-text-secondary">{excerpt}</p> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={{ pathname: "/blog", query: { page: p, category: sp.category } }}
                  className={`vm-focus-ring flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium ${
                    p === page ? "bg-yellow-400 text-text-on-yellow" : "text-text-secondary hover:bg-bg-sunken"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
