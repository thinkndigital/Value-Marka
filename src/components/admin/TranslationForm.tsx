"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { TranslationFormState } from "@/server/translations/actions";
import { upsertTranslationAction } from "@/server/translations/actions";

export function TranslationForm({
  categories,
  locales,
}: {
  categories: { id: string; name: string }[];
  locales: readonly string[];
}) {
  const [state, formAction, pending] = useActionState<TranslationFormState, FormData>(
    upsertTranslationAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="entityType" value="Category" />
      <input type="hidden" name="field" value="name" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="entityId" className="font-display text-sm font-semibold text-text-primary">
          Category
        </label>
        <select
          id="entityId"
          name="entityId"
          required
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="locale" className="font-display text-sm font-semibold text-text-primary">
          Locale
        </label>
        <select
          id="locale"
          name="locale"
          required
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <Input id="value" name="value" label="Translated name" error={state.fieldErrors?.value?.[0]} />

      <Button type="submit" variant="primary" size="sm" loading={pending}>
        Save translation
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
