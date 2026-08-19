import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/// Every dashboard/table in this codebase must render this instead of a
/// blank area when it has no rows (spec §64).
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-default px-6 py-16 text-center">
      <p className="font-display text-base font-semibold text-text-primary">
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
