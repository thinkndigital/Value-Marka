"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { AuthFormState } from "@/server/auth/actions";

type LoginAction = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function LoginForm({ action }: { action: LoginAction }) {
  const t = useTranslations("Auth.Login");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {},
  );

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
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        label={t("password")}
        error={state.errors?.password?.[0]}
      />
      <Link
        href="/forgot-password"
        className="text-end text-sm font-semibold text-navy-600 hover:underline"
      >
        {t("forgotPassword")}
      </Link>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-center text-sm text-text-secondary">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-navy-600 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
