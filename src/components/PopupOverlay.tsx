"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";

interface PopupData {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function dismissedKey(id: string) {
  return `vm-popup-dismissed-${id}`;
}

// A visitor who dismisses this popup shouldn't see it again until their
// browser session ends. There's no cross-tab live-sync requirement here
// (dismissing in one tab reappearing-or-not in another isn't something a
// visitor would notice or care about), so this listener set only exists to
// let useSyncExternalStore re-render this component the instant its own
// dismiss() call writes to sessionStorage.
const listeners = new Set<() => void>();
function subscribeToDismissals(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(dismissedKey(id)) === "1";
  } catch {
    return false; // sessionStorage unavailable (private mode, blocked) — show it.
  }
}

// Server-rendered and pre-hydration markup can't know sessionStorage, so
// they render as dismissed (nothing); useSyncExternalStore then re-renders
// with the real client snapshot right after hydration, per React's
// documented pattern for this exact case — no manual effect needed.
function alwaysDismissedOnServer() {
  return true;
}

export function PopupOverlay({ popup }: { popup: PopupData }) {
  const dismissed = useSyncExternalStore(
    subscribeToDismissals,
    () => isDismissed(popup.id),
    alwaysDismissedOnServer,
  );

  function dismiss() {
    try {
      sessionStorage.setItem(dismissedKey(popup.id), "1");
    } catch {
      // Nothing to persist — the popup will simply show again next load.
    }
    listeners.forEach((listener) => listener());
  }

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={popup.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="relative w-full max-w-md rounded-lg bg-bg-surface p-6 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="vm-focus-ring absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-sunken hover:text-text-primary"
        >
          ×
        </button>
        {popup.imageUrl ? (
          <div className="mb-4 aspect-video overflow-hidden rounded-md bg-bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={popup.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <h2 className="font-display text-xl font-bold text-text-primary">{popup.title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{popup.body}</p>
        {popup.ctaLabel && popup.ctaHref ? (
          <Button href={popup.ctaHref} variant="primary" className="mt-4" onClick={dismiss}>
            {popup.ctaLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
