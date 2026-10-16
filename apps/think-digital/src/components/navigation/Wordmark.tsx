import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Typographic placeholder for the Think Digital logo. The real logo file is
 * NEEDS SOURCE — replace this component's body with the SVG when it arrives;
 * every header/footer already renders through it.
 */
export function Wordmark({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href="/"
      aria-label={label}
      className={cn("inline-flex items-center gap-2 font-display text-lg font-bold leading-none", className)}
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-xs bg-primary text-primary-fg">
        <span className="ltr-island text-sm">TD</span>
      </span>
      <span aria-hidden className="ltr-island">Think Digital</span>
    </Link>
  );
}
