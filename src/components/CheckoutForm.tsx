"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { AddressForm } from "@/components/AddressForm";
import type { CheckoutFormState } from "@/server/checkout/actions";

interface AddressOption {
  id: string;
  label: string | null;
  fullName: string;
  addressLine1: string;
  city: string;
  countryCode: string;
  isDefault: boolean;
}

export function CheckoutForm({
  addresses,
  countries,
  placeOrderAction,
}: {
  addresses: AddressOption[];
  countries: { code: string; name: string }[];
  placeOrderAction: (
    state: CheckoutFormState,
    formData: FormData,
  ) => Promise<CheckoutFormState>;
}) {
  const t = useTranslations("Checkout");
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);
  const [selected, setSelected] = useState(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id,
  );
  const [state, formAction, pending] = useActionState<CheckoutFormState, FormData>(
    placeOrderAction,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-bold text-text-primary">{t("shippingAddress")}</h2>

      {addresses.length > 0 ? (
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default bg-bg-surface p-3 has-[:checked]:border-yellow-400"
            >
              <input
                type="radio"
                name="addressRadio"
                checked={selected === address.id}
                onChange={() => setSelected(address.id)}
                className="mt-1"
              />
              <div className="text-sm">
                <p className="font-medium text-text-primary">{address.label || address.fullName}</p>
                <p className="text-text-secondary">
                  {address.addressLine1}, {address.city}, {address.countryCode}
                </p>
              </div>
            </label>
          ))}
        </div>
      ) : null}

      {showNewAddress ? (
        <div className="rounded-lg border border-border-default bg-bg-surface p-4">
          <AddressForm countries={countries} onSuccess={() => setShowNewAddress(false)} />
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowNewAddress(true)}>
          {t("addAddress")}
        </Button>
      )}

      {addresses.length === 0 ? (
        <Alert variant="info">{t("noAddress")}</Alert>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="addressId" value={selected ?? ""} />
          {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
          <Alert variant="info">{t("awaitingPayment")}</Alert>
          <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!selected}>
            {pending ? t("placing") : t("placeOrder")}
          </Button>
        </form>
      )}
    </div>
  );
}
