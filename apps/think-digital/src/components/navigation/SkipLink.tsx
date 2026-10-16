export function SkipLink({ label, target = "#main" }: { label: string; target?: string }) {
  return (
    <a
      href={target}
      className="sr-only rounded-pill bg-inverse-bg px-5 py-3 text-sm font-semibold text-inverse-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[var(--z-toast)]"
    >
      {label}
    </a>
  );
}
