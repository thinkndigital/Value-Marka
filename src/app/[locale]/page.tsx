import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/ProductCard";
import {
  getHomepageHero,
  getFeaturedCategories,
  getNewArrivals,
} from "@/server/services/cms";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Search");
  const [hero, categories, products] = await Promise.all([
    getHomepageHero(locale),
    getFeaturedCategories(locale),
    getNewArrivals(locale),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />

      <main className="flex-1">
        {hero ? (
          <section className="border-b border-border-default bg-bg-surface">
            <div className="vm-container flex flex-col items-start gap-6 py-20">
              <Badge variant="brand">{hero.kicker}</Badge>
              <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-tight text-text-primary sm:text-5xl">
                {hero.title}
              </h1>
              <p className="max-w-xl text-lg text-text-secondary">{hero.subtitle}</p>
              <div className="flex flex-wrap gap-3">
                <Button href={hero.ctaPrimaryHref} variant="primary" size="lg">
                  {hero.ctaPrimaryLabel}
                </Button>
                <Button href={hero.ctaSecondaryHref} variant="outline" size="lg">
                  {hero.ctaSecondaryLabel}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {categories.length > 0 ? (
          <section className="vm-container flex flex-col gap-5 py-12">
            <h2 className="font-display text-xl font-bold text-text-primary">
              {t("allCategories")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={{ pathname: "/search", query: { category: category.slug } }}
                  className="vm-focus-ring flex flex-col items-center gap-2 rounded-lg border border-border-default bg-bg-surface p-3 text-center transition-shadow hover:shadow-md"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-md bg-bg-sunken">
                    {category.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <span className="line-clamp-2 text-sm font-medium text-text-primary">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {products.length > 0 ? (
          <section className="vm-container flex flex-col gap-5 py-12">
            <h2 className="font-display text-xl font-bold text-text-primary">
              {t("allProducts")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
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
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
