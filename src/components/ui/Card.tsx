import { clsx } from "clsx";
import type { ComponentPropsWithoutRef } from "react";

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border-default bg-bg-surface shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={clsx(
        "border-b border-border-default px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={clsx("px-6 py-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={clsx(
        "border-t border-border-default px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}
