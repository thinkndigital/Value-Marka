"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { FlashSaleFormState } from "@/server/flashSales/actions";

type FlashSaleAction = (state: FlashSaleFormState, formData: FormData) => Promise<FlashSaleFormState>;

function toLocalInputValue(date?: Date | string) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FlashSaleForm({
  action,
  initial,
  submitLabel = "Save flash sale",
  redirectTo = "/admin/marketing/flash-sales",
}: {
  action: FlashSaleAction;
  initial?: { name: string; startsAt: Date | string; endsAt: Date | string };
  submitLabel?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState<FlashSaleFormState, FormData>(action, {});
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
        label="Name"
        placeholder="Weekend Flash Deals"
        required
        defaultValue={initial?.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <Input
        id="startsAt"
        name="startsAt"
        type="datetime-local"
        label="Starts"
        required
        defaultValue={toLocalInputValue(initial?.startsAt)}
        error={state.fieldErrors?.startsAt?.[0]}
      />
      <Input
        id="endsAt"
        name="endsAt"
        type="datetime-local"
        label="Ends"
        required
        defaultValue={toLocalInputValue(initial?.endsAt)}
        error={state.fieldErrors?.endsAt?.[0]}
      />
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
