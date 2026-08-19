"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createReviewAction, type ReviewFormState } from "@/server/reviews/actions";

export function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const t = useTranslations("Product");
  const boundAction = createReviewAction.bind(null, productId, productSlug);
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(
    boundAction,
    {},
  );

  if (state.success) {
    return <Alert variant="success">{t("reviewSubmitted")}</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
      <h3 className="font-display text-sm font-bold text-text-primary">{t("writeReview")}</h3>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <div className="flex items-center gap-3">
        <label htmlFor="rating" className="text-sm font-medium text-text-secondary">
          {t("rating")}
        </label>
        <select
          id="rating"
          name="rating"
          defaultValue="5"
          className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-page px-3 text-sm text-text-primary"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {state.fieldErrors?.rating?.[0] ? (
          <p className="text-sm text-danger">{state.fieldErrors.rating[0]}</p>
        ) : null}
      </div>
      <input
        name="title"
        placeholder={t("reviewTitle")}
        className="vm-focus-ring h-10 rounded-md border border-border-default bg-bg-page px-3 text-sm text-text-primary"
      />
      <textarea
        name="body"
        placeholder={t("reviewBody")}
        rows={3}
        className="vm-focus-ring rounded-md border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary"
      />
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        {t("submitReview")}
      </Button>
    </form>
  );
}
