import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listWarehousesForSeller } from "@/server/services/warehouses";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ProductForm } from "@/components/seller/ProductForm";
import { createProductAction } from "@/server/products/actions";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const warehouses = await listWarehousesForSeller(seller.id);
  if (warehouses.length === 0) {
    return (
      <div className="vm-container py-16">
        <EmptyState
          title="Add a warehouse first"
          description="Every product needs a warehouse it ships from."
          action={
            <Button href="/seller/warehouses" variant="primary">
              Add warehouse
            </Button>
          }
        />
      </div>
    );
  }

  const [categories, brands, currencies] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New product</h1>
      <Card className="max-w-2xl">
        <CardBody>
          <ProductForm
            action={createProductAction}
            categories={categories}
            brands={brands}
            currencies={currencies}
            warehouses={warehouses}
            redirectOnSuccessTo="/seller/products"
          />
        </CardBody>
      </Card>
    </div>
  );
}
