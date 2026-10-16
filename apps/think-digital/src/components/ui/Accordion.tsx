import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

/**
 * Native <details>/<summary>: keyboard and screen-reader support for free,
 * works without JS. `name` makes it exclusive (one open at a time) in
 * supporting browsers; height animates via ::details-content where supported
 * (globals.css .td-accordion) and simply snaps elsewhere.
 */
export function Accordion({
  items,
  name,
  defaultOpenId,
  className,
}: {
  items: AccordionItem[];
  name?: string;
  defaultOpenId?: string;
  className?: string;
}) {
  return (
    <div className={cn("td-accordion border-t border-line", className)}>
      {items.map((item) => (
        <details key={item.id} id={item.id} name={name} open={item.id === defaultOpenId} className="group border-b border-line">
          <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-5 font-display text-h4 font-semibold hover:text-accent focus-visible:outline-offset-2">
            <span>{item.title}</span>
            <span
              aria-hidden
              className="td-accordion-icon grid size-9 shrink-0 place-items-center rounded-pill border border-line transition-transform duration-[var(--duration-normal)] ease-[var(--ease-standard)] group-hover:border-fg"
            >
              <Plus className="size-4" />
            </span>
          </summary>
          <div className="max-w-3xl pb-6 text-fg-muted">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
