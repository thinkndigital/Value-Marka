import { clsx } from "clsx";

/**
 * Text lockup matching the Value Marka brand: navy "value" + yellow "Marka".
 * Placeholder for the full mark (bag icon) until brand asset files (SVG/PNG)
 * are added to /public/branding — see ARCHITECTURE.md.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "font-display text-2xl font-extrabold tracking-tight",
        className,
      )}
    >
      <span className="text-navy-600">value</span>{" "}
      <span className="text-yellow-500">Marka</span>
    </span>
  );
}
