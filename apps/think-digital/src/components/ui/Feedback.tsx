import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const alertTones = {
  info: { cls: "border-info/30 bg-info-soft", icon: Info, iconCls: "text-info" },
  success: { cls: "border-success/30 bg-success-soft", icon: CheckCircle2, iconCls: "text-success" },
  warning: { cls: "border-warning/30 bg-warning-soft", icon: AlertTriangle, iconCls: "text-warning" },
  danger: { cls: "border-danger/30 bg-danger-soft", icon: XCircle, iconCls: "text-danger" },
} as const;

/**
 * Inline message. Errors use role="alert" (interrupting); everything else
 * role="status" (polite) so form results are announced to screen readers.
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = alertTones[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-sm border p-4 text-sm", t.cls, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", t.iconCls)} />
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        {children ? <div className="text-fg-muted">{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-xs bg-bg-sunken motion-safe:animate-pulse", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-fg-muted [&_svg]:size-8">{icon}</div> : null}
      <p className="font-display text-h4 font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
