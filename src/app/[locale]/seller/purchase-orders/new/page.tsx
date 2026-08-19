import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listSuppliersForSeller } from "@/server/services/suppliers";
import { listWarehousesForSeller } from "@/server/services/warehouses";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PurchaseOrderForm } from "@/components/seller/PurchaseOrderForm";

export default async function NewPurchaseOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const [suppliers, warehouses, products, currencies] = await Promise.all([
    listSuppliersForSeller(seller.id),
    listWarehousesForSeller(seller.id),
    prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, costPrice: true, currencyCode: true },
    }),
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  if (suppliers.length === 0 || warehouses.length === 0 || products.length === 0) {
    return (
      <div className="vm-container py-16">
        <EmptyState
          title="Set up suppliers, warehouses, and products first"
          description="A purchase order needs a supplier to order from, a warehouse to receive into, and at least one product."
          action={
            <Button href="/seller/suppliers" variant="primary">
              Add a supplier
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="vm-container flex max-w-2xl flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New purchase order</h1>
      <Card>
        <CardBody>
          <PurchaseOrderForm
            suppliers={suppliers}
            warehouses={warehouses}
            products={products.map((p) => ({ ...p, costPrice: p.costPrice.toString() }))}
            currencies={currencies}
          />
        </CardBody>
      </Card>
    </div>
  );
}
