import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-bg-sunken text-fg",
  brand: "bg-primary-soft text-accent",
  tech: "bg-info-soft text-tech-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  inverse: "bg-inverse-bg text-inverse-fg",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "NEW — New Animation" marker used by the Prompt Intelligence tool and changelogs. */
export function NewBadge({ label = "NEW", detail }: { label?: string; detail?: ReactNode }) {
  return (
    <Badge tone="brand">
      <span aria-hidden className="size-1.5 rounded-full bg-primary motion-safe:animate-[td-pulse_1.6s_ease-in-out_infinite]" />
      <span>{label}</span>
      {detail ? <span className="font-medium opacity-80">— {detail}</span> : null}
    </Badge>
  );
}

/** Outlined, non-interactive chip for services/technologies/tags. */
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border border-line px-3 py-1 text-sm text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
