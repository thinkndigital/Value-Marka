"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { ForgotPasswordFormState } from "@/server/auth/actions";

type ForgotPasswordAction = (
  state: ForgotPasswordFormState,
  formData: FormData,
) => Promise<ForgotPasswordFormState>;

export function ForgotPasswordForm({ action }: { action: ForgotPasswordAction }) {
  const t = useTranslations("Auth.ForgotPassword");
  const [state, formAction, pending] = useActionState<ForgotPasswordFormState, FormData>(
    action,
    {},
  );

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{t("success")}</Alert>
        <Link href="/login" className="text-center text-sm font-semibold text-navy-600 hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.formError ? <Alert variant="danger">{state.formError}</Alert> : null}
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        label={t("email")}
        error={state.errors?.email?.[0]}
      />
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <Link href="/login" className="text-center text-sm font-semibold text-navy-600 hover:underline">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
