import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FlashSaleForm } from "@/components/admin/FlashSaleForm";
import { FlashSaleItemForm } from "@/components/admin/FlashSaleItemForm";
import { getFlashSale, listActiveProductsForPicker, FlashSaleError } from "@/server/services/flashSales";
import {
  updateFlashSaleAction,
  addFlashSaleItemAction,
  removeFlashSaleItemAction,
} from "@/server/flashSales/actions";

export default async function EditFlashSalePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "campaigns.read"))) {
    return <Forbidden />;
  }
  const canUpdate = await hasPermission(user.id, "campaigns.update");

  let sale;
  try {
    sale = await getFlashSale(id);
  } catch (err) {
    if (err instanceof FlashSaleError) notFound();
    throw err;
  }

  const products = canUpdate ? await listActiveProductsForPicker() : [];
  const enrolledProductIds = new Set(sale.items.map((item) => item.productId));
  const availableProducts = products
    .filter((p) => !enrolledProductIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price.toString(),
      currencyCode: p.currencyCode,
      sellerName: p.seller.storeName,
    }));

  return (
    <div className="vm-container flex flex-col gap-8 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">{sale.name}</h1>
        <p className="text-sm text-text-muted">
          {sale.startsAt.toLocaleString()} → {sale.endsAt.toLocaleString()}
        </p>
      </div>

      {canUpdate ? (
        <Card className="max-w-lg">
          <CardBody>
            <FlashSaleForm
              action={updateFlashSaleAction.bind(null, sale.id)}
              initial={{ name: sale.name, startsAt: sale.startsAt, endsAt: sale.endsAt }}
              submitLabel="Save changes"
              redirectTo={`/admin/marketing/flash-sales/${sale.id}`}
            />
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold text-text-primary">Products in this sale</h2>

        {canUpdate ? (
          <Card>
            <CardBody>
              {availableProducts.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No more active products available to add — every active product is already
                  enrolled, or there are no active products yet.
                </p>
              ) : (
                <FlashSaleItemForm
                  action={addFlashSaleItemAction.bind(null, sale.id)}
                  products={availableProducts}
                />
              )}
            </CardBody>
          </Card>
        ) : null}

        {sale.items.length === 0 ? (
          <EmptyState
            title="No products in this sale yet"
            description="Add a product above to give it a time-boxed discount."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">Product</th>
                  <th className="px-4 py-3 text-start">Original price</th>
                  <th className="px-4 py-3 text-start">Discount</th>
                  <th className="px-4 py-3 text-start">Sale price</th>
                  <th className="px-4 py-3 text-start">Stock</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => {
                  const original = Number(item.product.price);
                  const discount = Number(item.discountPercent);
                  const salePrice = Math.round(original * (1 - discount / 100) * 100) / 100;
                  return (
                    <tr key={item.id} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{item.product.name}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {item.product.currencyCode} {original.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{discount}%</td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {item.product.currencyCode} {salePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {item.stockLimit !== null ? `${item.soldCount} / ${item.stockLimit}` : "Unlimited"}
                      </td>
                      <td className="px-4 py-3">
                        {canUpdate ? (
                          <div className="flex justify-end">
                            <DeleteButton
                              action={removeFlashSaleItemAction.bind(null, item.id, sale.id)}
                              confirmMessage={`Remove "${item.product.name}" from this sale?`}
                              label="Remove"
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
