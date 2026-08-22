"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { CurrencyFormState } from "@/server/currency/actions";

type CurrencyAction = (state: CurrencyFormState, formData: FormData) => Promise<CurrencyFormState>;

export function CurrencyForm({
  action,
  initial,
}: {
  action: CurrencyAction;
  initial: { name: string; symbol: string; decimalDigits: number };
}) {
  const [state, formAction, pending] = useActionState<CurrencyFormState, FormData>(action, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/admin/settings/currencies");
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="name"
        name="name"
        label="Display name"
        required
        defaultValue={initial.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <Input
        id="symbol"
        name="symbol"
        label="Symbol"
        required
        defaultValue={initial.symbol}
        error={state.fieldErrors?.symbol?.[0]}
      />
      <Input
        id="decimalDigits"
        name="decimalDigits"
        type="number"
        min="0"
        max="4"
        label="Decimal digits"
        required
        defaultValue={initial.decimalDigits}
        error={state.fieldErrors?.decimalDigits?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
