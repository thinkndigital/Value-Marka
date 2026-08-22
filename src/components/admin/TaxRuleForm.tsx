"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { SettingsFormState } from "@/server/settings/actions";

type SettingsAction = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function TaxRuleForm({
  action,
  countries,
  initial,
  submitLabel = "Save tax rule",
}: {
  action: SettingsAction;
  countries: { code: string; name: string }[];
  initial?: { countryCode: string; name: string; ratePercent: number; appliesTo: string };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/admin/settings/taxes");
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
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
      <Input
        id="name"
        name="name"
        label="Name"
        placeholder="Standard VAT"
        required
        defaultValue={initial?.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <Input
        id="ratePercent"
        name="ratePercent"
        type="number"
        step="0.01"
        min="0"
        max="100"
        label="Rate (%)"
        hint="e.g. 16 for 16%"
        required
        defaultValue={initial?.ratePercent}
        error={state.fieldErrors?.ratePercent?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="appliesTo" className="font-display text-sm font-semibold text-text-primary">
          Applies to
        </label>
        <select
          id="appliesTo"
          name="appliesTo"
          required
          defaultValue={initial?.appliesTo ?? "ALL"}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="ALL">Products and shipping</option>
          <option value="PRODUCT">Products only</option>
          <option value="SHIPPING">Shipping only</option>
        </select>
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
