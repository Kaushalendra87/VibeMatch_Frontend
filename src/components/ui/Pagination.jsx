/**
 * Page controls.
 *
 * The backend uses page-number pagination everywhere except message
 * history, so this works from `{page, totalPages, count}`. A page-number
 * control (rather than infinite scroll) is what the admin tables need, and
 * it keeps the two dashboards consistent.
 *
 * The window of page numbers is truncated with ellipses: a feed with 200
 * pages must not render 200 buttons.
 */

function buildPageWindow(current, total, siblings = 1) {
  // Always show first, last, current, and `siblings` either side. Everything
  // else collapses to an ellipsis marker.
  const totalNumbers = siblings * 2 + 5
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const left = Math.max(current - siblings, 2)
  const right = Math.min(current + siblings, total - 1)
  const pages = [1]

  if (left > 2) pages.push('start-ellipsis')
  for (let page = left; page <= right; page += 1) pages.push(page)
  if (right < total - 1) pages.push('end-ellipsis')

  pages.push(total)
  return pages
}

export function Pagination({
  page = 1,
  totalPages = 1,
  count,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) return null

  const pages = buildPageWindow(page, totalPages)

  const buttonClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {count != null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Page {page} of {totalPages} · {count.toLocaleString()}{' '}
          {count === 1 ? 'result' : 'results'}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${buttonClass} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
          </svg>
        </button>

        {pages.map((entry) =>
          typeof entry === 'number' ? (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
              className={`${buttonClass} ${
                entry === page
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {entry}
            </button>
          ) : (
            <span
              key={entry}
              aria-hidden="true"
              className="px-1 text-slate-400 dark:text-slate-600"
            >
              …
            </span>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={`${buttonClass} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
