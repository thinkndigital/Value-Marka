"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { CatalogFormState } from "@/server/catalog/actions";

type CatalogAction = (
  state: CatalogFormState,
  formData: FormData,
) => Promise<CatalogFormState>;

interface CategoryOption {
  id: string;
  name: string;
}

export function CategoryForm({
  action,
  categories,
  initial,
  submitLabel = "Save category",
}: {
  action: CatalogAction;
  categories: CategoryOption[];
  initial?: {
    name: string;
    slug: string;
    parentId: string | null;
    sortOrder: number;
    imageUrl: string | null;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CatalogFormState, FormData>(
    action,
    {},
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/admin/categories");
    }
  }, [state.success, router]);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input
        id="name"
        name="name"
        label="Name"
        required
        defaultValue={initial?.name}
        error={state.fieldErrors?.name?.[0]}
      />
      <Input
        id="slug"
        name="slug"
        label="Slug"
        required
        hint="Lowercase letters, numbers, and hyphens only."
        defaultValue={initial?.slug}
        error={state.fieldErrors?.slug?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="parentId" className="font-display text-sm font-semibold text-text-primary">
          Parent category
        </label>
        <select
          id="parentId"
          name="parentId"
          defaultValue={initial?.parentId ?? ""}
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          <option value="">None (top-level)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        id="sortOrder"
        name="sortOrder"
        type="number"
        label="Sort order"
        defaultValue={initial?.sortOrder ?? 0}
        error={state.fieldErrors?.sortOrder?.[0]}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className="font-display text-sm font-semibold text-text-primary">
          Image
        </label>
        {initial?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initial.imageUrl}
            alt=""
            className="h-16 w-16 rounded-md border border-border-default object-cover"
          />
        ) : null}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="vm-focus-ring text-sm"
        />
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
