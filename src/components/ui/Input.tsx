import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

interface InputProps extends ComponentPropsWithoutRef<"input"> {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: InputProps) {
  const describedBy = error
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-display text-sm font-semibold text-text-primary"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "vm-focus-ring h-11 rounded-md border bg-bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted",
          error ? "border-danger" : "border-border-default",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
