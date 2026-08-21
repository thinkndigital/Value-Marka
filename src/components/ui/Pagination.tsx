import { Link } from "@/i18n/navigation";

export function Pagination({
  page,
  totalPages,
  basePath,
  extraQuery = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  extraQuery?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between text-sm text-text-secondary" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={{ pathname: basePath, query: { ...extraQuery, page: String(page - 1) } }}
          className="vm-focus-ring rounded-md border border-border-default px-3 py-1.5 hover:bg-bg-sunken"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={{ pathname: basePath, query: { ...extraQuery, page: String(page + 1) } }}
          className="vm-focus-ring rounded-md border border-border-default px-3 py-1.5 hover:bg-bg-sunken"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
