import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

const variants = {
  neutral: "bg-bg-sunken text-text-secondary",
  brand: "bg-yellow-400 text-text-on-yellow",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
