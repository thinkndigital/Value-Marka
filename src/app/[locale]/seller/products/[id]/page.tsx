import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { getProductForSeller } from "@/server/services/products";
import { listWarehousesForSeller } from "@/server/services/warehouses";
import { listMovementsForInventory } from "@/server/services/inventory";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductForm } from "@/components/seller/ProductForm";
import { StockAdjustmentForm } from "@/components/seller/StockAdjustmentForm";
import { updateProductAction } from "@/server/products/actions";
import { ProductError } from "@/server/services/products";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { seller } = await requireApprovedSeller(locale);

  let product;
  try {
    product = await getProductForSeller(seller.id, id);
  } catch (err) {
    if (err instanceof ProductError) notFound();
    throw err;
  }

  const [categories, brands, currencies, warehouses] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
    listWarehousesForSeller(seller.id),
  ]);

  const movements =
    product.inventory.length > 0
      ? await listMovementsForInventory(product.inventory[0].id)
      : [];

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">{product.name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <ProductForm
              action={updateProductAction.bind(null, id)}
              categories={categories}
              brands={brands}
              currencies={currencies}
              initial={{
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                categoryId: product.categoryId,
                brandId: product.brandId,
                shortDescription: product.shortDescription,
                description: product.description,
                price: product.price.toString(),
                costPrice: product.costPrice.toString(),
                currencyCode: product.currencyCode,
                weightGrams: product.weightGrams,
              }}
              submitLabel="Save changes"
            />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <p className="font-display font-semibold text-text-primary">Images</p>
              {product.images.length === 0 ? (
                <p className="text-sm text-text-muted">No images uploaded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {product.images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.url}
                      alt=""
                      className="h-20 w-20 rounded-md border border-border-default object-cover"
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-4">
              <p className="font-display font-semibold text-text-primary">Stock</p>
              {warehouses.length === 0 ? (
                <EmptyState title="No warehouses" description="Add one to adjust stock." />
              ) : (
                <StockAdjustmentForm productId={product.id} warehouses={warehouses} />
              )}
              {product.inventory.length > 0 ? (
                <div className="flex flex-col gap-1 border-t border-border-default pt-3 text-sm">
                  {product.inventory.map((inv) => (
                    <div key={inv.id} className="flex justify-between text-text-secondary">
                      <span>{inv.warehouse.name}</span>
                      <span>
                        {inv.quantity - inv.reserved} available ({inv.quantity} on hand)
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {movements.length > 0 ? (
            <Card>
              <CardBody className="flex flex-col gap-2">
                <p className="font-display font-semibold text-text-primary">
                  Recent inventory movements
                </p>
                {movements.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex justify-between text-sm text-text-secondary">
                    <span>
                      {m.type} {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                    <span className="text-text-muted">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        m.createdAt,
                      )}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
