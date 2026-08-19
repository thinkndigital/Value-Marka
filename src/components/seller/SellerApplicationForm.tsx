"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  submitSellerApplicationAction,
  type SellerFormState,
} from "@/server/sellers/actions";

export function SellerApplicationForm({
  countries,
}: {
  countries: { code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<SellerFormState, FormData>(
    submitSellerApplicationAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="storeName"
        name="storeName"
        label="Store name"
        required
        error={state.fieldErrors?.storeName?.[0]}
      />
      <Input
        id="storeSlug"
        name="storeSlug"
        label="Store URL"
        required
        hint="value-marka.example/store/your-slug — lowercase letters, numbers, hyphens."
        error={state.fieldErrors?.storeSlug?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="countryCode" className="font-display text-sm font-semibold text-text-primary">
          Country
        </label>
        <select
          id="countryCode"
          name="countryCode"
          required
          defaultValue=""
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="" disabled>
            Select a country
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
        id="businessType"
        name="businessType"
        label="Business type"
        hint="e.g. Sole proprietorship, LLC, individual seller"
        required
        error={state.fieldErrors?.businessType?.[0]}
      />
      <Input
        id="taxId"
        name="taxId"
        label="Tax / commercial registration ID (optional)"
        error={state.fieldErrors?.taxId?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-display text-sm font-semibold text-text-primary">
          Tell us about your store (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        Submit application
      </Button>
    </form>
  );
}
