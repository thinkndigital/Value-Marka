import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckoutForm } from "@/components/CheckoutForm";
import { requireUser } from "@/server/auth/guards";
import { getCurrentCart } from "@/server/cart/resolve";
import { getActiveFlashSaleItemsForProducts, resolveEffectivePrice } from "@/server/services/flashSales";
import { listAddressesForUser } from "@/server/services/addresses";
import { placeOrderAction } from "@/server/checkout/actions";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Checkout");

  const [cart, addresses, countries] = await Promise.all([
    getCurrentCart(),
    listAddressesForUser(user.id),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader locale={locale} />
        <main id="main-content" className="flex-1">
          <div className="vm-container py-10">
            <EmptyState
              title={t("emptyCart")}
              action={
                <Button href="/search" variant="primary">
                  {t("title")}
                </Button>
              }
            />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const flashSaleItems = await getActiveFlashSaleItemsForProducts(items.map((item) => item.productId));
  const effectivePrices = items.map((item) =>
    resolveEffectivePrice(Number(item.product.price), flashSaleItems.get(item.productId)),
  );
  const subtotal =
    Math.round(
      items.reduce((sum, item, i) => sum + effectivePrices[i] * item.quantity, 0) * 100,
    ) / 100;
  const boundPlaceOrder = placeOrderAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />

      <main id="main-content" className="flex-1">
        <div className="vm-container flex flex-col gap-6 py-10">
          <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CheckoutForm
                addresses={addresses}
                countries={countries}
                placeOrderAction={boundPlaceOrder}
              />
            </div>

            <div className="flex h-fit flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-text-primary">
                {t("orderSummary")}
              </h2>
              {items.map((item, i) => (
                <div key={item.id} className="flex justify-between text-sm text-text-secondary">
                  <span>
                    {item.product.name} × {item.quantity}
                    {flashSaleItems.has(item.productId) ? (
                      <span className="ms-1 text-xs font-semibold text-danger">(sale)</span>
                    ) : null}
                  </span>
                  <span>
                    {item.product.currencyCode} {(effectivePrices[i] * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border-default pt-3 font-display text-base font-bold text-text-primary">
                <span>{t("subtotal")}</span>
                <span>
                  {cart?.currencyCode} {subtotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
