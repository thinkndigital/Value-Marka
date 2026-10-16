import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Service tile for hairline grids. Hover/focus fills the cell with the
 * group colour, nudges the arrow and reveals the description; on touch
 * (no hover) the description is always visible so nothing is hidden.
 */
export function ServiceCard({
  number,
  title,
  description,
  icon,
  href,
  tone = "brand",
  className,
}: {
  number: string;
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  href: string;
  tone?: "brand" | "tech";
  className?: string;
}) {
  const fill =
    tone === "tech"
      ? "hover:bg-tech hover:text-tech-fg focus-visible:bg-tech focus-visible:text-tech-fg"
      : "hover:bg-primary hover:text-primary-fg focus-visible:bg-primary focus-visible:text-primary-fg";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-64 flex-col justify-between gap-8 bg-bg-elevated p-6 outline-offset-[-3px] md:p-8",
        "transition-colors duration-[var(--duration-normal)] ease-[var(--ease-standard)]",
        fill,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="ltr-island font-display text-sm font-semibold opacity-70">{number}</span>
        <ArrowUpRight
          aria-hidden
          className="flip-rtl size-6 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-emphasized)] group-hover:-translate-y-1 group-hover:translate-x-[calc(var(--dir)*4px)]"
        />
      </div>
      <div className="flex flex-col gap-3">
        {icon ? <div className="mb-2 [&_svg]:size-8">{icon}</div> : null}
        <h3 className="text-h3">{title}</h3>
        <p
          className={cn(
            "text-sm opacity-80",
            "pointer-fine:max-h-0 pointer-fine:overflow-hidden pointer-fine:opacity-0",
            "pointer-fine:transition-[max-height,opacity] pointer-fine:duration-[var(--duration-slow)] pointer-fine:ease-[var(--ease-standard)]",
            "pointer-fine:group-hover:max-h-40 pointer-fine:group-hover:opacity-80 pointer-fine:group-focus-visible:max-h-40 pointer-fine:group-focus-visible:opacity-80",
          )}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}

/** Hairline grid wrapper (1px gaps over the border colour, Remote Way-style). */
export function ServiceGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
