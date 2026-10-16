import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const variants = {
  outline: "border border-line bg-bg-elevated",
  plain: "bg-bg-elevated",
  sunken: "bg-bg-sunken",
  inverse: "surface-inverse",
} as const;

export type CardVariant = keyof typeof variants;

type CardProps<T extends ElementType> = {
  as?: T;
  variant?: CardVariant;
  /** Hover lift + border emphasis; use only when the whole card is a link. */
  interactive?: boolean;
  padded?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Card<T extends ElementType = "div">({
  as,
  variant = "outline",
  interactive = false,
  padded = true,
  className,
  children,
  ...props
}: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={cn(
        "relative rounded-md",
        variants[variant],
        padded && "p-6 md:p-8",
        interactive && "motion-lift hover:border-fg focus-within:border-fg",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
