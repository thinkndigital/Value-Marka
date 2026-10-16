"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Supplementary text for an already-labelled control (never the only label).
 * Shows on hover and keyboard focus, stays open while hovered (the bubble is
 * inside the hover area), and Esc dismisses it — WCAG 2.2 SC 1.4.13.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  /** The trigger; its first focusable element gets aria-describedby. */
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = wrapper.current?.querySelector<HTMLElement>("a, button, input, select, textarea, [tabindex]");
    target?.setAttribute("aria-describedby", id);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span
      ref={wrapper}
      className={cn("relative inline-flex", className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "absolute bottom-full start-1/2 z-[var(--z-overlay)] mb-2 w-max max-w-64 rounded-xs bg-inverse-bg px-3 py-2 text-xs font-medium text-inverse-fg shadow-md",
          "translate-x-[calc(var(--dir)*-50%)] transition-[opacity,translate] duration-[var(--duration-fast)] ease-[var(--ease-enter)]",
          // The ::after bridge covers the mb-2 gap so the pointer can travel onto the bubble.
          "after:absolute after:inset-x-0 after:top-full after:h-2",
          open ? "opacity-100" : "pointer-events-none invisible translate-y-1 opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
