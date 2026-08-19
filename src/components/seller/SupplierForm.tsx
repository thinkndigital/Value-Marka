"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  createSupplierAction,
  updateSupplierAction,
  type SupplierFormState,
} from "@/server/suppliers/actions";

interface SupplierFormProps {
  countries: { code: string; name: string }[];
  supplier?: {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    countryCode: string | null;
    address: string | null;
    paymentTerms: string | null;
  };
}

export function SupplierForm({ countries, supplier }: SupplierFormProps) {
  const action = supplier ? updateSupplierAction.bind(null, supplier.id) : createSupplierAction;
  const [state, formAction, pending] = useActionState<SupplierFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="companyName"
        name="companyName"
        label="Company name"
        required
        defaultValue={supplier?.companyName}
        error={state.fieldErrors?.companyName?.[0]}
      />
      <Input
        id="contactName"
        name="contactName"
        label="Contact name"
        defaultValue={supplier?.contactName ?? ""}
        error={state.fieldErrors?.contactName?.[0]}
      />
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        defaultValue={supplier?.email ?? ""}
        error={state.fieldErrors?.email?.[0]}
      />
      <Input
        id="phone"
        name="phone"
        label="Phone"
        defaultValue={supplier?.phone ?? ""}
        error={state.fieldErrors?.phone?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="countryCode" className="font-display text-sm font-semibold text-text-primary">
          Country
        </label>
        <select
          id="countryCode"
          name="countryCode"
          defaultValue={supplier?.countryCode ?? ""}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        id="address"
        name="address"
        label="Address"
        defaultValue={supplier?.address ?? ""}
        error={state.fieldErrors?.address?.[0]}
      />
      <Input
        id="paymentTerms"
        name="paymentTerms"
        label="Payment terms"
        defaultValue={supplier?.paymentTerms ?? ""}
        error={state.fieldErrors?.paymentTerms?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending}>
        {supplier ? "Save changes" : "Add supplier"}
      </Button>
    </form>
  );
}
