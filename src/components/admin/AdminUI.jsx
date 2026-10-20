/**
 * Shared admin presentation pieces.
 *
 * The admin dashboard is eight screens that are mostly the same three
 * things — a header, a row of stat tiles, and a paginated table. Building
 * those once means a change to the table's empty state or the header's
 * spacing lands everywhere, which is the difference between a dashboard
 * that looks consistent and one that almost does.
 *
 * `DataTable` is deliberately not a general-purpose table component. It
 * takes columns and rows and handles the states every one of these
 * screens needs: loading, error, empty, and pagination. It does not do
 * sorting or column resizing — the server owns ordering, and a client
 * sort over one page of results is a lie about the data.
 */

import { Link } from 'react-router-dom'

import { Pagination } from '../ui/Pagination'
import { EmptyState, ErrorState, RowListSkeleton } from '../ui/States'

/** A page title, subtitle, optional back link and action slot. */
export function PageHeader({ title, description, backTo, backLabel, actions, children }) {
  return (
    <header className="mb-5">
      {backTo ? (
        <Link
          to={backTo}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
          {backLabel || 'Back'}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="heading-page">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </header>
  )
}

/**
 * A headline figure.
 *
 * `change` is a percentage or `null`. **`null` is rendered as "—", not
 * "0%".** The server sends null when there is no prior period to compare
 * against, and showing 0% would assert "no change" where the truth is
 * "not measurable yet" — see `adminpanel.services._pct_change`.
 */
export function StatCard({ label, value, change, hint, tone = 'neutral', icon }) {
  const toneClass = {
    neutral: 'text-slate-900 dark:text-slate-100',
    brand: 'text-brand-600 dark:text-brand-400',
    success: 'text-sage-600 dark:text-sage-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  }[tone]

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? (
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>

      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>

      <div className="mt-1 flex items-center gap-2">
        {change != null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              change > 0
                ? 'text-sage-600 dark:text-sage-400'
                : change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <svg
              className={`h-3 w-3 ${change < 0 ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0-6 6m6-6 6 6" />
            </svg>
            {Math.abs(change)}%
          </span>
        ) : null}
        {hint ? (
          <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A labelled value for a detail panel.
 *
 * `format` is a function so a caller can render money, a date or a badge
 * without this component knowing about any of them.
 */
export function DetailField({ label, value, format, className = '' }) {
  const isEmpty = value == null || value === '' || value === false
  const rendered = format && !isEmpty ? format(value) : value

  return (
    <div className={className}>
      <dt className="eyebrow">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
        {isEmpty ? <span className="text-slate-400 dark:text-slate-600">—</span> : rendered}
      </dd>
    </div>
  )
}

/** A titled panel, for grouping detail fields. */
export function Panel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-sand-200 p-4 dark:border-sand-800">
          <div>
            <h2 className="heading-section">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

/**
 * The standard table wrapper.
 *
 * Columns are `{key, header, render, className, align}`. `render` receives
 * the whole row, not just the cell value, because almost every column
 * here needs a second field — a status chip needs the status *and* its
 * display label.
 *
 * Horizontal scroll is on the wrapper rather than the table so the
 * pagination below it stays put. An admin table on a phone is a genuinely
 * awkward thing; scrolling the table while the controls stay reachable is
 * the least bad option.
 */
export function DataTable({
  columns,
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowKey = (row) => row.id,
  page = 1,
  totalPages = 1,
  count,
  onPageChange,
  caption,
}) {
  if (isError) return <ErrorState error={error} onRetry={onRetry} />

  if (isLoading) {
    return (
      <div className="card p-4">
        <RowListSkeleton count={6} />
      </div>
    )
  }

  if (!rows?.length) {
    return (
      <div className="card">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="border-b border-sand-200 bg-slate-50 dark:border-sand-800 dark:bg-slate-900/60">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={[
                      'eyebrow whitespace-nowrap px-4 py-3',
                      column.align === 'right' ? 'text-right' : '',
                      column.className || '',
                    ].join(' ')}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        'px-4 py-3 align-middle text-slate-700 dark:text-slate-300',
                        column.align === 'right' ? 'text-right' : '',
                        column.className || '',
                      ].join(' ')}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onPageChange ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          count={count}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  )
}

/**
 * A search box that only fires on submit or after a pause.
 *
 * Debounced because the user table is a server query: firing on every
 * keystroke means a request per character, and the last one to land is
 * not necessarily the last one sent.
 */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }) {
  return (
    <div className="relative">
      <label htmlFor="admin-search" className="sr-only">
        {label}
      </label>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20.5 20.5l-4.5-4.5" />
      </svg>
      <input
        id="admin-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  )
}

/** A select for filtering a table by one field. */
export function FilterSelect({ id, label, value, onChange, options, allLabel = 'All' }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
