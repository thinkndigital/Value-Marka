import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function SellerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const [productCount, activeProductCount, warehouseCount] = await Promise.all([
    prisma.product.count({ where: { sellerId: seller.id } }),
    prisma.product.count({ where: { sellerId: seller.id, status: "ACTIVE" } }),
    prisma.warehouse.count({ where: { sellerId: seller.id } }),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        Welcome back, {seller.storeName}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Products" value={productCount} />
        <Stat label="Active products" value={activeProductCount} />
        <Stat label="Warehouses" value={warehouseCount} />
      </div>

      {warehouseCount === 0 ? (
        <Card className="max-w-lg">
          <CardBody className="flex flex-col gap-3">
            <p className="font-display font-semibold text-text-primary">
              Add a warehouse to start listing products
            </p>
            <p className="text-sm text-text-secondary">
              Every product needs a warehouse it ships from.
            </p>
            <Button href="/seller/warehouses" variant="primary" className="self-start">
              Add warehouse
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Button href="/seller/products/new" variant="primary" className="self-start">
          Add a product
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="font-display text-3xl font-bold text-text-primary">{value}</p>
      </CardBody>
    </Card>
  );
}
