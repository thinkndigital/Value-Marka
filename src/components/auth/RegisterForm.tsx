"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { AuthFormState } from "@/server/auth/actions";

type RegisterAction = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function RegisterForm({
  action,
  refCode,
}: {
  action: RegisterAction;
  refCode?: string;
}) {
  const t = useTranslations("Auth.Register");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {refCode ? <input type="hidden" name="ref" value={refCode} /> : null}
      {state.formError ? <Alert variant="danger">{state.formError}</Alert> : null}
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          required
          label={t("firstName")}
          error={state.errors?.firstName?.[0]}
        />
        <Input
          id="lastName"
          name="lastName"
          autoComplete="family-name"
          required
          label={t("lastName")}
          error={state.errors?.lastName?.[0]}
        />
      </div>
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
        autoComplete="new-password"
        required
        label={t("password")}
        hint={state.errors?.password ? undefined : t("passwordHint")}
        error={state.errors?.password?.[0]}
      />
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-center text-sm text-text-secondary">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-navy-600 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
