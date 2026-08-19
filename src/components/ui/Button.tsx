import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

const base =
  "vm-focus-ring inline-flex items-center justify-center gap-2 font-display font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-yellow-400 text-text-on-yellow hover:bg-yellow-500",
  secondary: "bg-navy-600 text-white hover:bg-navy-700",
  outline:
    "border border-border-strong text-text-primary bg-transparent hover:bg-bg-sunken",
  ghost: "text-text-primary bg-transparent hover:bg-bg-sunken",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

const sizes = {
  sm: "h-9 rounded-md px-3 text-sm",
  md: "h-11 rounded-md px-5 text-sm",
  lg: "h-13 rounded-lg px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}

type ButtonAsButton = SharedProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };

type ButtonAsLink = SharedProps &
  ComponentPropsWithoutRef<typeof Link> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = clsx(base, variants[variant], sizes[size], className);

  if (props.href) {
    const { href, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { disabled, ...rest } = props as ButtonAsButton;
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
