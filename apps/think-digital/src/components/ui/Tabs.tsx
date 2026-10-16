"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation and roving tabindex. Arrow keys
 * follow the visual direction, so ArrowLeft moves *forward* in RTL.
 */
export function Tabs({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function focus(i: number) {
    const next = (i + items.length) % items.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) focus(active + 1);
    else if (e.key === back) focus(active - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(items.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`${base}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "relative min-h-12 whitespace-nowrap px-4 font-display text-sm font-semibold text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-fg",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-fg after:transition-transform after:duration-[var(--duration-normal)] after:ease-[var(--ease-standard)]",
              i === active && "text-fg after:scale-x-100",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          id={`${base}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="pt-6 focus-visible:outline-offset-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
