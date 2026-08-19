import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listSuppliersForSeller } from "@/server/services/suppliers";
import { deleteSupplierAction } from "@/server/suppliers/actions";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SupplierForm } from "@/components/seller/SupplierForm";

export default async function SellerSuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const [suppliers, countries] = await Promise.all([
    listSuppliersForSeller(seller.id),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Suppliers</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {suppliers.length === 0 ? (
            <EmptyState title="No suppliers yet" description="Add one to start creating purchase orders." />
          ) : (
            suppliers.map((supplier) => (
              <Card key={supplier.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">{supplier.companyName}</p>
                    <p className="text-sm text-text-secondary">
                      {supplier.contactName}
                      {supplier.email ? ` · ${supplier.email}` : ""}
                    </p>
                  </div>
                  <DeleteButton
                    action={deleteSupplierAction.bind(null, supplier.id)}
                    confirmMessage="Delete this supplier?"
                    label="Delete"
                  />
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <SupplierForm countries={countries} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
