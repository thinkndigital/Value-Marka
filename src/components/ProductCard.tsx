import { Link } from "@/i18n/navigation";

interface ProductCardData {
  slug: string;
  name: string;
  price: string | number;
  currencyCode: string;
  imageUrl?: string | null;
  sellerName?: string;
  flashSale?: { discountPercent: number; salePrice: number } | null;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="vm-focus-ring relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface transition-shadow hover:shadow-md"
    >
      {product.flashSale ? (
        <span className="absolute start-2 top-2 z-10 rounded-pill bg-danger px-2 py-1 text-[11px] font-bold text-white">
          -{product.flashSale.discountPercent}%
        </span>
      ) : null}
      <div className="aspect-square bg-bg-sunken">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-text-primary">{product.name}</p>
        {product.sellerName ? (
          <p className="text-xs text-text-muted">{product.sellerName}</p>
        ) : null}
        {product.flashSale ? (
          <p className="flex items-baseline gap-2">
            <span className="font-display text-sm font-bold text-danger">
              {product.currencyCode} {product.flashSale.salePrice.toFixed(2)}
            </span>
            <span className="text-xs text-text-muted line-through">
              {product.currencyCode} {product.price.toString()}
            </span>
          </p>
        ) : (
          <p className="font-display text-sm font-bold text-text-primary">
            {product.currencyCode} {product.price.toString()}
          </p>
        )}
      </div>
    </Link>
  );
}
