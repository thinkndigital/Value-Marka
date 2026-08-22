"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { resetPasswordAction, type ResetPasswordFormState } from "@/server/auth/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth.ResetPassword");
  const [state, formAction, pending] = useActionState<ResetPasswordFormState, FormData>(
    resetPasswordAction,
    {},
  );

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{t("success")}</Alert>
        <Link href="/login" className="text-center text-sm font-semibold text-navy-600 hover:underline">
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.formError ? <Alert variant="danger">{state.formError}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        label={t("password")}
        hint={t("passwordHint")}
        error={state.errors?.password?.[0]}
      />
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
