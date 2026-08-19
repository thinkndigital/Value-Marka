import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listWarehousesForSeller } from "@/server/services/warehouses";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { WarehouseForm } from "@/components/seller/WarehouseForm";

export default async function SellerWarehousesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const [warehouses, countries] = await Promise.all([
    listWarehousesForSeller(seller.id),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Warehouses</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {warehouses.length === 0 ? (
            <EmptyState
              title="No warehouses yet"
              description="Add one to start listing products."
            />
          ) : (
            warehouses.map((w) => (
              <Card key={w.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">{w.name}</p>
                    <p className="text-sm text-text-secondary">
                      {w.city}, {w.countryCode}
                    </p>
                  </div>
                  {w.isDefault ? <Badge variant="brand">Default</Badge> : null}
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <WarehouseForm countries={countries} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
