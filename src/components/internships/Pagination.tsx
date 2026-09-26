import Link from 'next/link';

/**
 * URL based pagination: every state lives in the query string, so back/forward and shared
 * links behave exactly like the server rendered list.
 */
export function Pagination({
  page,
  pageCount,
  total,
  searchParams,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
  pageSize: number;
}) {
  if (total === 0) return null;

  const hrefFor = (target: number, size = pageSize): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || key === 'pageSize') continue;
      if (typeof value === 'string') params.set(key, value);
      else if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    }
    if (target > 1) params.set('page', String(target));
    if (size !== 25) params.set('pageSize', String(size));
    const query = params.toString();
    return query ? `/internships?${query}` : '/internships';
  };

  const numbers = pageNumbers(page, pageCount);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-xs text-ink-500">
        Page {page} of {pageCount} · {total} records
      </p>

      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-lg border border-cream-400 px-2.5 py-1 hover:border-ink-500">
            ← Previous
          </Link>
        ) : null}

        {numbers.map((entry, index) =>
          entry === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-ink-500">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={hrefFor(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1 ${
                entry === page ? 'bg-ink-900 text-cream-100' : 'border border-cream-400 hover:border-ink-500'
              }`}
            >
              {entry}
            </Link>
          ),
        )}

        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className="rounded-lg border border-cream-400 px-2.5 py-1 hover:border-ink-500">
            Next →
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-ink-500">per page</span>
        {[10, 25, 50, 100].map((size) => (
          <Link
            key={size}
            href={hrefFor(1, size)}
            className={`rounded-md px-2 py-1 ${
              size === pageSize ? 'bg-clay-100 text-clay-700' : 'text-ink-600 hover:bg-cream-200'
            }`}
          >
            {size}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function pageNumbers(page: number, pageCount: number): Array<number | '…'> {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((entry) => entry >= 1 && entry <= pageCount).sort((a, b) => a - b);
  const output: Array<number | '…'> = [];
  let previous = 0;
  for (const entry of sorted) {
    if (previous && entry - previous > 1) output.push('…');
    output.push(entry);
    previous = entry;
  }
  return output;
}
