/** An inline loading indicator. Sized by the parent's font size. */
export function Spinner({ className = '', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className={`inline-flex ${className}`}>
      <svg
        className="h-5 w-5 animate-spin text-current"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
    </span>
  )
}

/** Full-panel loading state, for a page or a card that has nothing yet. */
export function LoadingState({ message = 'Loading…', className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400 ${className}`}
    >
      <Spinner />
      <p className="text-sm">{message}</p>
    </div>
  )
}
