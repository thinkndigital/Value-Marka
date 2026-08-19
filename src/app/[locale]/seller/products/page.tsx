import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listProductsForSeller } from "@/server/services/products";
import { listWarehousesForSeller } from "@/server/services/warehouses";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusToggleButton } from "@/components/seller/StatusToggleButton";
import { CsvImportForm } from "@/components/seller/CsvImportForm";

export default async function SellerProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);
  const [products, warehouses] = await Promise.all([
    listProductsForSeller(seller.id),
    listWarehousesForSeller(seller.id),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Products</h1>
        <div className="flex gap-2">
          <Button href="/api/seller/products/export" variant="outline" size="sm">
            Export CSV
          </Button>
          <Button href="/seller/products/new" variant="primary" size="sm">
            New product
          </Button>
        </div>
      </div>

      {warehouses.length > 0 ? (
        <details className="rounded-lg border border-border-default bg-bg-surface">
          <summary className="cursor-pointer px-5 py-3 font-display text-sm font-semibold text-text-primary">
            Bulk import from CSV
          </summary>
          <div className="border-t border-border-default">
            <Card className="border-0">
              <CardBody>
                <CsvImportForm warehouses={warehouses} />
              </CardBody>
            </Card>
          </div>
        </details>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Products you add will appear here."
          action={
            <Button href="/seller/products/new" variant="primary">
              Add your first product
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Product</th>
                <th className="px-4 py-3 text-start">Category</th>
                <th className="px-4 py-3 text-start">Price</th>
                <th className="px-4 py-3 text-start">Stock</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stock = product.inventory.reduce(
                  (sum, row) => sum + (row.quantity - row.reserved),
                  0,
                );
                return (
                  <tr key={product.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{product.name}</p>
                      <p className="text-xs text-text-muted">{product.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{product.category.name}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {product.currencyCode} {product.price.toString()}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{stock}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.status === "ACTIVE" ? "success" : "neutral"}>
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button href={`/seller/products/${product.id}`} variant="outline" size="sm">
                          Edit
                        </Button>
                        <StatusToggleButton productId={product.id} status={product.status === "ACTIVE" ? "ACTIVE" : "ARCHIVED"} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
