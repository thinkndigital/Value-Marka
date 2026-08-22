"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { SettingsFormState } from "@/server/settings/actions";

type SettingsAction = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function ShippingZoneForm({
  action,
  countries,
  initial,
  submitLabel = "Save zone",
  redirectTo = "/admin/settings/shipping",
}: {
  action: SettingsAction;
  countries: { code: string; name: string }[];
  initial?: { name: string; countryCode: string };
  submitLabel?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push(redirectTo);
  }, [state.success, router, redirectTo]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="name"
        name="name"
        label="Zone name"
        placeholder="Jordan — standard"
        required
        defaultValue={initial?.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="countryCode" className="font-display text-sm font-semibold text-text-primary">
          Country
        </label>
        <select
          id="countryCode"
          name="countryCode"
          required
          defaultValue={initial?.countryCode ?? ""}
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
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
