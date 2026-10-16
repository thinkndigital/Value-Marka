import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

const base =
  "group/btn inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill font-display font-semibold " +
  "transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  secondary: "bg-inverse-bg text-inverse-fg hover:opacity-90",
  tech: "bg-tech text-tech-fg hover:bg-tech-hover",
  outline: "border border-line-strong bg-transparent text-fg hover:border-fg",
  ghost: "bg-transparent text-fg hover:bg-bg-sunken",
} as const;

// sm is desktop-dense only; on coarse pointers every size meets the 44px target.
const sizes = {
  sm: "h-10 px-4 text-sm pointer-coarse:h-11",
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-8 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing icon; arrows/chevrons should pass flip-rtl in their className. */
  icon?: ReactNode;
  /** Nudges the trailing icon toward the reading direction on hover. */
  nudge?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = SharedProps & Omit<ComponentPropsWithoutRef<"button">, keyof SharedProps> & { href?: undefined };
type ButtonAsLink = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof SharedProps> & { href: string; external?: boolean };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

function Content({ icon, nudge, loading, children }: Pick<SharedProps, "icon" | "nudge" | "loading" | "children">) {
  return (
    <>
      {loading ? (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      <span>{children}</span>
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "inline-flex motion-nudge",
            nudge && "group-hover/btn:translate-x-[calc(var(--dir)*4px)] group-focus-visible/btn:translate-x-[calc(var(--dir)*4px)]",
          )}
        >
          {icon}
        </span>
      ) : null}
    </>
  );
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", icon, nudge = true, loading = false, className, children } = props;
  const classes = buttonClasses(variant, size, className);

  if (props.href !== undefined) {
    const { href, external, variant: _v, size: _s, icon: _i, nudge: _n, loading: _l, className: _c, children: _ch, ...rest } =
      props as ButtonAsLink;
    if (external) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
          <Content icon={icon} nudge={nudge}>
            {children}
          </Content>
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        <Content icon={icon} nudge={nudge}>
          {children}
        </Content>
      </Link>
    );
  }

  const { variant: _v, size: _s, icon: _i, nudge: _n, loading: _l, className: _c, children: _ch, disabled, type, ...rest } =
    props as ButtonAsButton;
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} nudge={nudge} loading={loading}>
        {children}
      </Content>
    </button>
  );
}
