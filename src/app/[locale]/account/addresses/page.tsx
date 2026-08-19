import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { listAddressesForUser } from "@/server/services/addresses";
import { deleteAddressAction, setDefaultAddressAction } from "@/server/addresses/actions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { AddressForm } from "@/components/AddressForm";

export default async function AddressesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Address");

  const [addresses, countries] = await Promise.all([
    listAddressesForUser(user.id),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {addresses.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            addresses.map((address) => (
              <Card key={address.id}>
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-text-primary">
                      {address.label || address.fullName}
                    </p>
                    {address.isDefault ? <Badge variant="brand">{t("default")}</Badge> : null}
                  </div>
                  <p className="text-sm text-text-secondary">{address.fullName}</p>
                  <p className="text-sm text-text-secondary">{address.phone}</p>
                  <p className="text-sm text-text-secondary">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {address.city}, {address.countryCode}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {!address.isDefault ? (
                      <DeleteButton
                        action={setDefaultAddressAction.bind(null, address.id)}
                        label={t("setDefault")}
                      />
                    ) : null}
                    <DeleteButton
                      action={deleteAddressAction.bind(null, address.id)}
                      confirmMessage={t("confirmDelete")}
                      label={t("delete")}
                    />
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <AddressForm countries={countries} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
