import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { Badge } from "@/components/ui/Badge";
import { AddToCartForm } from "@/components/AddToCartForm";
import { WishlistButton } from "@/components/WishlistButton";
import { ReviewForm } from "@/components/ReviewForm";
import { getActiveProductBySlug } from "@/server/services/products";
import { getAvailableStock } from "@/server/services/inventory";
import { listReviewsForProduct } from "@/server/services/reviews";
import { isProductWishlisted } from "@/server/services/wishlist";
import { getCurrentUser } from "@/server/auth/dal";
import { getActiveFlashSaleItemForProduct, computeEffectivePrice } from "@/server/services/flashSales";
import { FlashSaleCountdown } from "@/components/FlashSaleCountdown";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.seoTitle ?? `${product.name} — Value Marka`,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    alternates: { canonical: `${appUrl()}/${locale}/product/${slug}` },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) notFound();

  const t = await getTranslations("Product");
  const [available, reviews, user, flashSale] = await Promise.all([
    getAvailableStock(product.id),
    listReviewsForProduct(product.id),
    getCurrentUser(),
    getActiveFlashSaleItemForProduct(product.id),
  ]);
  const salePrice = flashSale
    ? computeEffectivePrice(Number(product.price), flashSale.discountPercent)
    : null;
  const remainingFlashStock =
    flashSale?.stockLimit !== null && flashSale?.stockLimit !== undefined
      ? Math.max(flashSale.stockLimit - flashSale.soldCount, 0)
      : null;
  const wishlisted = user ? await isProductWishlisted(user.id, product.id) : false;
  const userAlreadyReviewed = user ? reviews.some((r) => r.userId === user.id) : false;
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  const base = appUrl();
  const productUrl = `${base}/${locale}/product/${product.slug}`;

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.shortDescription ?? product.description ?? undefined,
          sku: product.sku,
          image: product.images.map((img) => img.url),
          brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: product.currencyCode,
            price: salePrice !== null ? salePrice.toFixed(2) : product.price.toString(),
            availability:
              available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: product.seller.storeName },
          },
          ...(avgRating !== null
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: avgRating,
                  reviewCount: reviews.length,
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${base}/${locale}` },
            ...(product.category
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: product.category.name,
                    item: `${base}/${locale}/search?category=${product.category.slug}`,
                  },
                ]
              : []),
            { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: productUrl },
          ],
        }}
      />
      <SiteHeader locale={locale} />

      <main id="main-content" className="flex-1">
        <div className="vm-container flex flex-col gap-10 py-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="aspect-square overflow-hidden rounded-lg border border-border-default bg-bg-sunken">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0].url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              {product.images.length > 1 ? (
                <div className="grid grid-cols-5 gap-2">
                  {product.images.slice(1, 6).map((img) => (
                    <div
                      key={img.id}
                      className="aspect-square overflow-hidden rounded-md border border-border-default bg-bg-sunken"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              {product.category ? <Badge variant="neutral">{product.category.name}</Badge> : null}
              <h1 className="font-display text-3xl font-bold text-text-primary">{product.name}</h1>
              <Link
                href={`/store/${product.seller.storeSlug}`}
                className="text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                {t("soldBy", { storeName: product.seller.storeName })}
              </Link>

              {avgRating !== null ? (
                <p className="text-sm text-text-secondary">
                  ★ {avgRating} · {reviews.length}
                </p>
              ) : null}

              {flashSale && salePrice !== null ? (
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <p className="font-display text-3xl font-extrabold text-danger">
                      {product.currencyCode} {salePrice.toFixed(2)}
                    </p>
                    <p className="font-display text-lg font-medium text-text-muted line-through">
                      {product.currencyCode} {product.price.toString()}
                    </p>
                    <span className="rounded-pill bg-danger px-2.5 py-1 text-xs font-bold text-white">
                      -{flashSale.discountPercent}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                    <span>Deal ends in</span>
                    <FlashSaleCountdown endsAt={flashSale.endsAt.toISOString()} />
                    {remainingFlashStock !== null ? (
                      <span>· {remainingFlashStock} left at this price</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="font-display text-3xl font-extrabold text-text-primary">
                  {product.currencyCode} {product.price.toString()}
                </p>
              )}

              <p className="text-sm text-text-muted">
                {available > 0 ? t("inStock", { count: available }) : t("outOfStock")}
              </p>

              {product.shortDescription ? (
                <p className="text-text-secondary">{product.shortDescription}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <AddToCartForm productId={product.id} available={available} />
                <WishlistButton
                  productId={product.id}
                  productSlug={product.slug}
                  initialWishlisted={wishlisted}
                  signedIn={Boolean(user)}
                />
              </div>
            </div>
          </div>

          {product.description ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold text-text-primary">
                {t("description")}
              </h2>
              <p className="whitespace-pre-line text-text-secondary">{product.description}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold text-text-primary">
              {t("reviewsTitle")}
            </h2>

            {reviews.length === 0 ? (
              <p className="text-sm text-text-muted">{t("noReviews")}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-border-default bg-bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-bold text-text-primary">
                        {review.user.firstName} {review.user.lastName.charAt(0)}.
                      </p>
                      <span className="text-sm text-text-muted">{"★".repeat(review.rating)}</span>
                    </div>
                    {review.title ? (
                      <p className="mt-1 font-medium text-text-primary">{review.title}</p>
                    ) : null}
                    {review.body ? <p className="mt-1 text-text-secondary">{review.body}</p> : null}
                  </div>
                ))}
              </div>
            )}

            {user ? (
              userAlreadyReviewed ? (
                <p className="text-sm text-text-muted">{t("alreadyReviewed")}</p>
              ) : (
                <ReviewForm productId={product.id} productSlug={product.slug} />
              )
            ) : (
              <p className="text-sm text-text-muted">{t("signInToReview")}</p>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
