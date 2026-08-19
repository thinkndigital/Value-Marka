import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth/guards";
import { listWishlistForUser } from "@/server/services/wishlist";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "@/components/ProductCard";
import { RemoveFromWishlistButton } from "@/components/RemoveFromWishlistButton";

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Wishlist");

  const items = await listWishlistForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <ProductCard
                product={{
                  slug: item.product.slug,
                  name: item.product.name,
                  price: item.product.price.toString(),
                  currencyCode: item.product.currencyCode,
                  imageUrl: item.product.images[0]?.url,
                  sellerName: item.product.seller.storeName,
                }}
              />
              <RemoveFromWishlistButton productId={item.productId} label={t("remove")} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
