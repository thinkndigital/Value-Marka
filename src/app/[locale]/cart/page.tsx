import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartItemRow } from "@/components/CartItemRow";
import { getCurrentCart } from "@/server/cart/resolve";
import { computeCartTotals } from "@/server/services/cart";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, cart] = await Promise.all([getTranslations("Cart"), getCurrentCart()]);
  const items = cart?.items ?? [];
  const { subtotal } = computeCartTotals(
    items.map((item) => ({ quantity: item.quantity, product: { price: item.product.price } })),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />

      <main className="flex-1">
        <div className="vm-container flex flex-col gap-6 py-10">
          <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

          {items.length === 0 ? (
            <EmptyState
              title={t("empty")}
              action={
                <Button href="/search" variant="primary">
                  {t("browseProducts")}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="rounded-lg border border-border-default bg-bg-surface px-4 lg:col-span-2">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    id={item.id}
                    slug={item.product.slug}
                    name={item.product.name}
                    imageUrl={item.product.images[0]?.url}
                    sellerName={item.product.seller.storeName}
                    currencyCode={item.product.currencyCode}
                    price={item.product.price.toString()}
                    quantity={item.quantity}
                    lineTotal={(Number(item.product.price) * item.quantity).toFixed(2)}
                  />
                ))}
              </div>

              <div className="flex h-fit flex-col gap-4 rounded-lg border border-border-default bg-bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">{t("subtotal")}</span>
                  <span className="font-display text-lg font-bold text-text-primary">
                    {cart?.currencyCode} {subtotal.toFixed(2)}
                  </span>
                </div>
                <Button href="/checkout" variant="primary" size="lg">
                  {t("checkout")}
                </Button>
                <Link href="/search" className="text-center text-sm text-text-secondary hover:text-text-primary">
                  {t("continueShopping")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
