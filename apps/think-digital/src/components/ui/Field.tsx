import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/*
 * Form primitives. Field wires label + hint + error to the control through
 * ids derived from `name`, so every control is labelled and its error is
 * announced (aria-invalid + aria-describedby) without per-form plumbing.
 */

const control =
  "w-full rounded-xs border border-line-strong bg-bg-elevated px-4 text-body text-fg placeholder:text-fg-muted/70 " +
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "hover:border-fg-muted focus-visible:border-focus focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25";

interface FieldProps {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Text shown after the label for required fields, e.g. "(مطلوب)". */
  requiredLabel?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export function Field({ name, label, hint, error, required, requiredLabel, className, children }: FieldProps) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
        {required ? (
          <span className="ms-1 font-normal text-fg-muted">
            <span aria-hidden>*</span>
            {requiredLabel ? <span className="sr-only">{requiredLabel}</span> : null}
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ControlA11y = { id: string; describedBy?: string; invalid?: boolean };

export function Input({
  id,
  describedBy,
  invalid,
  className,
  ...props
}: ControlA11y & Omit<ComponentPropsWithoutRef<"input">, "id">) {
  return (
    <input
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(control, "h-12", className)}
      {...props}
    />
  );
}

export function Textarea({
  id,
  describedBy,
  invalid,
  className,
  ...props
}: ControlA11y & Omit<ComponentPropsWithoutRef<"textarea">, "id">) {
  return (
    <textarea
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(control, "min-h-36 py-3", className)}
      {...props}
    />
  );
}

export function Select({
  id,
  describedBy,
  invalid,
  className,
  children,
  ...props
}: ControlA11y & Omit<ComponentPropsWithoutRef<"select">, "id">) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(control, "h-12 appearance-none pe-11", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-4 my-auto size-4 text-fg-muted"
      />
    </div>
  );
}

export function Checkbox({
  name,
  label,
  className,
  ...props
}: { name: string; label: ReactNode } & Omit<ComponentPropsWithoutRef<"input">, "type" | "name">) {
  const id = props.id ?? `field-${name}`;
  return (
    <label htmlFor={id} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm", className)}>
      <input
        id={id}
        name={name}
        type="checkbox"
        className="size-5 shrink-0 cursor-pointer rounded-xs border-line-strong accent-[var(--primary)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
