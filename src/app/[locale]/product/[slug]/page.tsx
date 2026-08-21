import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/Badge";
import { AddToCartForm } from "@/components/AddToCartForm";
import { WishlistButton } from "@/components/WishlistButton";
import { ReviewForm } from "@/components/ReviewForm";
import { getActiveProductBySlug } from "@/server/services/products";
import { getAvailableStock } from "@/server/services/inventory";
import { listReviewsForProduct } from "@/server/services/reviews";
import { isProductWishlisted } from "@/server/services/wishlist";
import { getCurrentUser } from "@/server/auth/dal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.seoTitle ?? `${product.name} — Value Marka`,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
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
  const [available, reviews, user] = await Promise.all([
    getAvailableStock(product.id),
    listReviewsForProduct(product.id),
    getCurrentUser(),
  ]);
  const wishlisted = user ? await isProductWishlisted(user.id, product.id) : false;
  const userAlreadyReviewed = user ? reviews.some((r) => r.userId === user.id) : false;
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return (
    <div className="flex min-h-screen flex-col">
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

              <p className="font-display text-3xl font-extrabold text-text-primary">
                {product.currencyCode} {product.price.toString()}
              </p>

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
