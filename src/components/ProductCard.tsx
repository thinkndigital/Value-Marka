import { Link } from "@/i18n/navigation";

interface ProductCardData {
  slug: string;
  name: string;
  price: string | number;
  currencyCode: string;
  imageUrl?: string | null;
  sellerName?: string;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="vm-focus-ring flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface transition-shadow hover:shadow-md"
    >
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
        <p className="font-display text-sm font-bold text-text-primary">
          {product.currencyCode} {product.price.toString()}
        </p>
      </div>
    </Link>
  );
}
