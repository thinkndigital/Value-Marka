import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The one section heading pattern: "01 — eyebrow" index, title, lead and
 * optional actions. `as` keeps the heading outline correct per page.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
  actions,
  align = "start",
  as: Heading = "h2",
  className,
}: {
  index?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("flex max-w-3xl flex-col gap-4", align === "center" && "items-center")}>
        {index || eyebrow ? (
          <p className="eyebrow flex items-center gap-3">
            {index ? <span className="ltr-island text-accent">{index}</span> : null}
            {index && eyebrow ? <span aria-hidden className="h-px w-8 bg-line-strong" /> : null}
            {eyebrow ? <span>{eyebrow}</span> : null}
          </p>
        ) : null}
        <Heading className={Heading === "h1" ? "text-h1" : "text-h2"}>{title}</Heading>
        {lead ? <p className="text-body-lg text-fg-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
