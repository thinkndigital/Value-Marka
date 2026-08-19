"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  createAddressAction,
  updateAddressAction,
  type AddressFormState,
} from "@/server/addresses/actions";

interface AddressFormProps {
  countries: { code: string; name: string }[];
  address?: {
    id: string;
    label: string | null;
    fullName: string;
    phone: string;
    countryCode: string;
    city: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string | null;
    isDefault: boolean;
  };
  onSuccess?: () => void;
}

export function AddressForm({ countries, address, onSuccess }: AddressFormProps) {
  const t = useTranslations("Address");
  const action = address ? updateAddressAction.bind(null, address.id) : createAddressAction;
  const [state, formAction, pending] = useActionState<AddressFormState, FormData>(action, {});

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="label"
        name="label"
        label={t("label")}
        defaultValue={address?.label ?? ""}
        error={state.fieldErrors?.label?.[0]}
      />
      <Input
        id="fullName"
        name="fullName"
        label={t("fullName")}
        required
        defaultValue={address?.fullName}
        error={state.fieldErrors?.fullName?.[0]}
      />
      <Input
        id="phone"
        name="phone"
        label={t("phone")}
        required
        defaultValue={address?.phone}
        error={state.fieldErrors?.phone?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="countryCode" className="font-display text-sm font-semibold text-text-primary">
          {t("country")}
        </label>
        <select
          id="countryCode"
          name="countryCode"
          required
          defaultValue={address?.countryCode ?? ""}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            —
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.countryCode?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.countryCode[0]}</p>
        ) : null}
      </div>
      <Input
        id="city"
        name="city"
        label={t("city")}
        required
        defaultValue={address?.city}
        error={state.fieldErrors?.city?.[0]}
      />
      <Input
        id="addressLine1"
        name="addressLine1"
        label={t("addressLine1")}
        required
        defaultValue={address?.addressLine1}
        error={state.fieldErrors?.addressLine1?.[0]}
      />
      <Input
        id="addressLine2"
        name="addressLine2"
        label={t("addressLine2")}
        defaultValue={address?.addressLine2 ?? ""}
        error={state.fieldErrors?.addressLine2?.[0]}
      />
      <Input
        id="postalCode"
        name="postalCode"
        label={t("postalCode")}
        defaultValue={address?.postalCode ?? ""}
        error={state.fieldErrors?.postalCode?.[0]}
      />
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className="vm-focus-ring"
        />
        {t("setDefault")}
      </label>
      <Button type="submit" variant="primary" loading={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
