"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createBlogCategoryAction, type BlogFormState } from "@/server/blog/actions";

export function BlogCategoryForm() {
  const [state, formAction, pending] = useActionState<BlogFormState, FormData>(
    createBlogCategoryAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error ? (
        <div className="w-full">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      ) : null}
      <Input
        id="slug"
        name="slug"
        label="Slug"
        placeholder="tips"
        className="w-40"
        error={state.fieldErrors?.slug?.[0]}
      />
      <Input id="nameEn" name="nameEn" label="English name" className="w-48" error={state.fieldErrors?.nameEn?.[0]} />
      <Input
        id="nameAr"
        name="nameAr"
        label="Arabic name"
        dir="rtl"
        className="w-48"
        error={state.fieldErrors?.nameAr?.[0]}
      />
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Add category
      </Button>
    </form>
  );
}
