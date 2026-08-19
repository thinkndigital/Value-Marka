import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

const variants = {
  success: "bg-success-bg text-success border-success/20",
  danger: "bg-danger-bg text-danger border-danger/20",
  warning: "bg-warning-bg text-warning border-warning/20",
  info: "bg-info-bg text-info border-info/20",
} as const;

export type AlertVariant = keyof typeof variants;

export function Alert({
  variant = "info",
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={clsx(
        "rounded-md border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
