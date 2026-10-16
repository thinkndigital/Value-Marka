"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, type ButtonVariant } from "./Button";

/**
 * Modal built on native <dialog>.showModal(): focus is trapped, the page is
 * inert, Esc closes, and focus returns to the trigger — all by the browser.
 * We add a labelled close button and click-on-backdrop to close.
 */
export function Dialog({
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  closeLabel,
  children,
  className,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  return (
    <>
      <Button variant={triggerVariant} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className={cn(
          "td-dialog m-auto w-[min(100%-2rem,36rem)] rounded-lg border border-line bg-bg-elevated p-0 text-fg shadow-overlay",
          className,
        )}
      >
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-h3">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={closeLabel}
              className="hit-target -m-2 grid place-items-center rounded-pill text-fg-muted hover:bg-bg-sunken hover:text-fg"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {description ? (
            <p id={descId} className="text-fg-muted">
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </dialog>
    </>
  );
}
