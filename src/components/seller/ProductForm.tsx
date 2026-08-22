"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRouter } from "@/i18n/navigation";
import type { ProductFormState } from "@/server/products/actions";

type ProductAction = (
  state: ProductFormState,
  formData: FormData,
) => Promise<ProductFormState>;

interface Option {
  id: string;
  name: string;
}

export function ProductForm({
  action,
  categories,
  brands,
  currencies,
  warehouses,
  initial,
  submitLabel = "Create product",
  redirectOnSuccessTo,
}: {
  action: ProductAction;
  categories: Option[];
  brands: Option[];
  currencies: { code: string; name: string }[];
  warehouses?: Option[];
  redirectOnSuccessTo?: string;
  initial?: {
    name: string;
    slug: string;
    sku: string;
    categoryId: string;
    brandId: string | null;
    shortDescription: string | null;
    description: string | null;
    price: string;
    costPrice: string;
    currencyCode: string;
    weightGrams: number | null;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    {},
  );
  const isCreate = warehouses !== undefined;
  const [productType, setProductType] = useState<"SIMPLE" | "DIGITAL" | "BUNDLE">("SIMPLE");
  const router = useRouter();

  useEffect(() => {
    if (state.success && redirectOnSuccessTo) {
      router.push(redirectOnSuccessTo);
    }
  }, [state.success, redirectOnSuccessTo, router]);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success && !redirectOnSuccessTo ? (
        <Alert variant="success">Saved.</Alert>
      ) : null}

      <Input id="name" name="name" label="Product name" required defaultValue={initial?.name} error={state.fieldErrors?.name?.[0]} />
      <Input id="slug" name="slug" label="Product URL" required hint="Lowercase letters, numbers, and hyphens only." defaultValue={initial?.slug} error={state.fieldErrors?.slug?.[0]} />
      <Input id="sku" name="sku" label="SKU" required defaultValue={initial?.sku} error={state.fieldErrors?.sku?.[0]} />

      {isCreate ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="font-display text-sm font-semibold text-text-primary">
            Product type
          </label>
          <select
            id="type"
            name="type"
            value={productType}
            onChange={(e) => setProductType(e.target.value as "SIMPLE" | "DIGITAL" | "BUNDLE")}
            className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
          >
            <option value="SIMPLE">Physical product</option>
            <option value="DIGITAL">Digital product (file download)</option>
            <option value="BUNDLE">Bundle (multiple products sold together)</option>
          </select>
          <p className="text-sm text-text-muted">
            Type can&apos;t be changed after creation.
            {productType === "BUNDLE" ? " Add the bundle's components after creating it." : ""}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="font-display text-sm font-semibold text-text-primary">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={initial?.categoryId ?? ""}
            className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.categoryId?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.categoryId[0]}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="brandId" className="font-display text-sm font-semibold text-text-primary">
            Brand (optional)
          </label>
          <select
            id="brandId"
            name="brandId"
            defaultValue={initial?.brandId ?? ""}
            className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
          >
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input id="price" name="price" label="Price" required defaultValue={initial?.price} error={state.fieldErrors?.price?.[0]} />
        <Input id="costPrice" name="costPrice" label="Cost price" required defaultValue={initial?.costPrice} error={state.fieldErrors?.costPrice?.[0]} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="currencyCode" className="font-display text-sm font-semibold text-text-primary">
            Currency
          </label>
          <select
            id="currencyCode"
            name="currencyCode"
            required
            defaultValue={initial?.currencyCode ?? ""}
            className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
          >
            <option value="" disabled>
              Currency
            </option>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Input
        id="weightGrams"
        name="weightGrams"
        type="number"
        label="Weight (grams, optional)"
        defaultValue={initial?.weightGrams ?? undefined}
      />

      <Input
        id="shortDescription"
        name="shortDescription"
        label="Short description (optional)"
        defaultValue={initial?.shortDescription ?? undefined}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-display text-sm font-semibold text-text-primary">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={initial?.description ?? undefined}
          className="vm-focus-ring rounded-md border border-border-default bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="images" className="font-display text-sm font-semibold text-text-primary">
          {isCreate ? "Images" : "Add more images"}
        </label>
        <input
          id="images"
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="vm-focus-ring text-sm"
        />
      </div>

      {isCreate && productType === "DIGITAL" ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border-default bg-bg-sunken p-4">
          <label htmlFor="digitalFile" className="font-display text-sm font-semibold text-text-primary">
            File customers will download
          </label>
          <input
            id="digitalFile"
            name="digitalFile"
            type="file"
            required
            className="vm-focus-ring text-sm"
          />
          <p className="text-sm text-text-muted">
            Stored privately — buyers only ever get a short-lived, signed download link from their
            order, never the file&apos;s storage location.
          </p>
          {state.fieldErrors?.digitalFile?.[0] ? (
            <p className="text-sm text-danger">{state.fieldErrors.digitalFile[0]}</p>
          ) : null}
        </div>
      ) : null}

      {isCreate && productType === "SIMPLE" ? (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-border-default bg-bg-sunken p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="warehouseId" className="font-display text-sm font-semibold text-text-primary">
              Ships from
            </label>
            <select
              id="warehouseId"
              name="warehouseId"
              required
              defaultValue=""
              className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
            >
              <option value="" disabled>
                Select a warehouse
              </option>
              {warehouses!.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.warehouseId?.[0] ? (
              <p className="text-sm text-danger">{state.fieldErrors.warehouseId[0]}</p>
            ) : null}
          </div>
          <Input
            id="initialQuantity"
            name="initialQuantity"
            type="number"
            label="Opening stock"
            defaultValue={0}
            min={0}
          />
        </div>
      ) : null}

      <Button type="submit" variant="primary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
