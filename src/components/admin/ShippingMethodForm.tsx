"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { SettingsFormState } from "@/server/settings/actions";

type SettingsAction = (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function ShippingMethodForm({
  action,
  zoneId,
  initial,
  submitLabel = "Save method",
}: {
  action: SettingsAction;
  zoneId: string;
  initial?: {
    name: string;
    price: number;
    freeThreshold: number | null;
    estimatedDaysMin: number | null;
    estimatedDaysMax: number | null;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push(`/admin/settings/shipping/zones/${zoneId}`);
  }, [state.success, router, zoneId]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="name"
        name="name"
        label="Method name"
        placeholder="Standard delivery"
        required
        defaultValue={initial?.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <Input
        id="price"
        name="price"
        type="number"
        step="0.01"
        min="0"
        label="Price"
        required
        defaultValue={initial?.price}
        error={state.fieldErrors?.price?.[0]}
      />
      <Input
        id="freeThreshold"
        name="freeThreshold"
        type="number"
        step="0.01"
        min="0"
        label="Free above (optional)"
        hint="Order subtotal at or above this amount ships free."
        defaultValue={initial?.freeThreshold ?? undefined}
        error={state.fieldErrors?.freeThreshold?.[0]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="estimatedDaysMin"
          name="estimatedDaysMin"
          type="number"
          min="0"
          label="Min days (optional)"
          defaultValue={initial?.estimatedDaysMin ?? undefined}
          error={state.fieldErrors?.estimatedDaysMin?.[0]}
        />
        <Input
          id="estimatedDaysMax"
          name="estimatedDaysMax"
          type="number"
          min="0"
          label="Max days (optional)"
          defaultValue={initial?.estimatedDaysMax ?? undefined}
          error={state.fieldErrors?.estimatedDaysMax?.[0]}
        />
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
