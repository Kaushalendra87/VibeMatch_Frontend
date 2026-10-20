/**
 * Empty, error and skeleton states.
 *
 * Collected in one module because the spec asks for all three "everywhere",
 * and the way that actually happens is by making them a one-line import
 * rather than something each page reinvents.
 */

import { Spinner } from './Spinner'

/** Nothing here — but the request succeeded. */
export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className}`}
    >
      {icon ? (
        <div className="text-slate-400 dark:text-slate-600" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h3>
      {description ? (
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/**
 * Something failed.
 *
 * `ApiError` from the client carries a human-readable `message` already
 * derived from the server's error envelope, so this does not need to
 * interpret status codes. A network failure is called out separately
 * because "check your connection" and "the server rejected that" call for
 * different user actions.
 */
export function ErrorState({ error, onRetry, className = '' }) {
  const isNetwork = error?.isNetworkError
  const message =
    error?.message ||
    'Something went wrong. Please try again.'

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className}`}
    >
      <div className="text-red-500 dark:text-red-400" aria-hidden="true">
        <svg
          className="h-10 w-10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
        {isNetwork ? 'Connection problem' : 'Something went wrong'}
      </h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {error?.requestId ? (
        // Surfaced so a user can quote it to support, and so a bug report
        // can be tied to a server log line.
        <p className="font-mono text-xs text-slate-400 dark:text-slate-600">
          Reference: {error.requestId}
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary mt-2">
          Try again
        </button>
      ) : null}
    </div>
  )
}

/** A pulsing placeholder block. */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-sand-200 dark:bg-sand-800 ${className}`}
      aria-hidden="true"
    />
  )
}

/**
 * A card-shaped skeleton.
 *
 * Sized to the real card so the layout does not jump when data lands —
 * a spinner of the wrong height causes a visible reflow on every load.
 * The `h-80` here must track `ProfileCard`'s photo height for the same
 * reason; the two drifting apart is a reflow nobody would trace back.
 */
export function CardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <Skeleton className="h-80 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2 border-t border-sand-100 pt-4 dark:border-sand-800">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-11 flex-1 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** A grid of card skeletons, for a feed that is still loading. */
export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

/** A list of row skeletons, for a table or a chat list. */
export function RowListSkeleton({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A centered spinner for a *refetch* of content already on screen.
 *
 * Deliberately not the skeleton: replacing loaded content with a
 * placeholder on every background refetch is more jarring than a quiet
 * indicator, and React Query refetches on window focus by default.
 */
export function RefreshingIndicator({ isFetching, className = '' }) {
  if (!isFetching) return null
  return (
    <div
      className={`flex items-center justify-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    >
      <Spinner className="[&>svg]:h-3.5 [&>svg]:w-3.5" label="Refreshing" />
      <span>Updating…</span>
    </div>
  )
}

/**
 * Render whichever of the three states applies, or the children.
 *
 * The common shape — `if (loading) … if (error) … if (!data) …` — written
 * once. `isEmpty` is a predicate rather than a length so a caller can
 * treat a filtered-to-nothing list differently from a genuinely empty one.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  loadingMessage,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  skeleton,
  children,
}) {
  if (isLoading) {
    return skeleton ?? (
      <div className="flex justify-center py-12">
        <Spinner />
        {loadingMessage ? (
          <span className="sr-only">{loadingMessage}</span>
        ) : null}
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }
  return children
}
