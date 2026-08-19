import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

export function Skeleton({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden
      className={clsx("animate-pulse rounded-md bg-bg-sunken", className)}
      {...props}
    />
  );
}
