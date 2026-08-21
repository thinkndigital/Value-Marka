import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { searchProducts, listSearchableCategories, type SearchSort } from "@/server/services/search";

const SORTS: SearchSort[] = ["newest", "price_asc", "price_desc"];

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim();
  const sort = SORTS.includes(sp.sort as SearchSort) ? (sp.sort as SearchSort) : "newest";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const [t, results, categories] = await Promise.all([
    getTranslations("Search"),
    searchProducts({ q, categorySlug: sp.category, sort, page }),
    listSearchableCategories(),
  ]);

  const baseQuery = { q, category: sp.category, sort };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />

      <main id="main-content" className="flex-1">
        <div className="vm-container flex flex-col gap-6 py-10">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {q ? t("resultsFor", { query: q }) : t("title")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("resultCount", { count: results.total })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={{ pathname: "/search", query: { q, sort } }}
              className="vm-focus-ring"
            >
              <Badge variant={!sp.category ? "brand" : "neutral"}>{t("allCategories")}</Badge>
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={{ pathname: "/search", query: { q, sort, category: category.slug } }}
                className="vm-focus-ring"
              >
                <Badge variant={sp.category === category.slug ? "brand" : "neutral"}>
                  {category.name}
                </Badge>
              </Link>
            ))}

            <div className="ms-auto flex items-center gap-2 text-sm text-text-secondary">
              <label htmlFor="sort" className="font-medium">
                {t("sortLabel")}
              </label>
              <form action={`/${locale}/search`} method="GET">
                {q ? <input type="hidden" name="q" value={q} /> : null}
                {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
                <select
                  id="sort"
                  name="sort"
                  defaultValue={sort}
                  className="vm-focus-ring h-9 rounded-md border border-border-default bg-bg-surface px-2.5 text-sm text-text-primary"
                >
                  <option value="newest">{t("sortNewest")}</option>
                  <option value="price_asc">{t("sortPriceAsc")}</option>
                  <option value="price_desc">{t("sortPriceDesc")}</option>
                </select>
              </form>
            </div>
          </div>

          {results.items.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      slug: product.slug,
                      name: product.name,
                      price: product.price.toString(),
                      currencyCode: product.currencyCode,
                      imageUrl: product.images[0]?.url,
                      sellerName: product.seller.storeName,
                    }}
                  />
                ))}
              </div>

              {results.pageCount > 1 ? (
                <nav className="flex items-center justify-center gap-2">
                  {Array.from({ length: results.pageCount }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={{ pathname: "/search", query: { ...baseQuery, page: p } }}
                      className={`vm-focus-ring flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium ${
                        p === page
                          ? "bg-yellow-400 text-text-on-yellow"
                          : "text-text-secondary hover:bg-bg-sunken"
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
