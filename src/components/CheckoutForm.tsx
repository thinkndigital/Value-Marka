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
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "STRIPE" | "PAYPAL">("COD");
  const [state, formAction, pending] = useActionState<CheckoutFormState, FormData>(
    placeOrderAction,
    {},
  );

  // Re-sync when the address list changes underneath us — most notably
  // right after adding the very first address inline (revalidatePath
  // refreshes `addresses` without remounting this component, so the
  // useState above never re-runs its initializer on its own). Adjusted
  // during render rather than in an effect, per React's own guidance for
  // this exact "derive state from a changed prop" case.
  const [prevAddresses, setPrevAddresses] = useState(addresses);
  if (addresses !== prevAddresses) {
    setPrevAddresses(addresses);
    if (!selected || !addresses.some((a) => a.id === selected)) {
      setSelected(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id);
    }
  }

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

          <h2 className="font-display text-lg font-bold text-text-primary">{t("paymentMethod")}</h2>
          <div className="flex flex-col gap-2">
            {(
              [
                ["COD", t("cod")],
                ["STRIPE", t("payWithCard")],
                ["PAYPAL", t("payWithPaypal")],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-bg-surface p-3 has-[:checked]:border-yellow-400"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={value}
                  checked={paymentMethod === value}
                  onChange={() => setPaymentMethod(value)}
                />
                <span className="text-sm font-medium text-text-primary">{label}</span>
              </label>
            ))}
          </div>

          {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
          <Alert variant="info">{paymentMethod === "COD" ? t("codNote") : t("onlinePaymentNote")}</Alert>
          <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!selected}>
            {pending ? t("placing") : t("placeOrder")}
          </Button>
        </form>
      )}
    </div>
  );
}
