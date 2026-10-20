/**
 * Status chips.
 *
 * Colour alone never carries the meaning — each badge pairs its colour
 * with a text label, so the status is readable without colour vision and
 * in a screen reader.
 */

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  success: 'bg-sage-100 text-sage-700 dark:bg-sage-950 dark:text-sage-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
}

export function Badge({ tone = 'neutral', children, className = '', icon }) {
  return (
    <span className={`badge ${TONES[tone] ?? TONES.neutral} ${className}`}>
      {icon ? <span className="mr-1" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  )
}

/** A verified check, sized to sit inside a badge or beside a name. */
export function VerifiedBadge({ size = 'sm', showLabel = false, className = '' }) {
  const dimension = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <span
      className={`inline-flex items-center gap-1 text-sky-500 ${className}`}
      title="Verified profile"
    >
      <svg
        className={dimension}
        viewBox="0 0 24 24"
        fill="currentColor"
        // `role="img"` with a label, because a bare checkmark conveys
        // nothing to a screen reader.
        role="img"
        aria-label="Verified"
      >
        <path
          fillRule="evenodd"
          d="M8.6 3.8a2.25 2.25 0 0 1 3.4-1.3l.6.4c.3.2.6.3 1 .3s.7-.1 1-.3l.6-.4a2.25 2.25 0 0 1 3.4 1.3l.2.7c.1.3.3.6.6.8l.7.4a2.25 2.25 0 0 1 .9 3.2l-.4.6c-.2.3-.3.6-.3 1s.1.7.3 1l.4.6a2.25 2.25 0 0 1-.9 3.2l-.7.4c-.3.2-.5.5-.6.8l-.2.7a2.25 2.25 0 0 1-3.4 1.3l-.6-.4c-.3-.2-.6-.3-1-.3s-.7.1-1 .3l-.6.4a2.25 2.25 0 0 1-3.4-1.3l-.2-.7a1.8 1.8 0 0 0-.6-.8l-.7-.4a2.25 2.25 0 0 1-.9-3.2l.4-.6c.2-.3.3-.6.3-1s-.1-.7-.3-1l-.4-.6a2.25 2.25 0 0 1 .9-3.2l.7-.4c.3-.2.5-.5.6-.8l.2-.7Zm7.2 6.4a1 1 0 0 0-1.6-1.2l-2.7 3.6-1.3-1.3a1 1 0 0 0-1.4 1.4l2.1 2.1a1 1 0 0 0 1.5-.1l3.4-4.5Z"
          clipRule="evenodd"
        />
      </svg>
      {showLabel ? <span className="text-xs font-medium">Verified</span> : null}
    </span>
  )
}

/** The online/offline dot with a text alternative. */
export function PresenceDot({ isOnline, showLabel = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? 'bg-sage-500' : 'bg-slate-400 dark:bg-slate-600'}`}
        aria-hidden="true"
      />
      {showLabel ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      ) : (
        <span className="sr-only">{isOnline ? 'Online' : 'Offline'}</span>
      )}
    </span>
  )
}

/**
 * The match score.
 *
 * Rendered as a percentage because that is what the API sends
 * (`match_score` is 0-100), and colour-graded so a glance down a feed
 * sorts itself. The number is always present, so the colour is redundant
 * rather than load-bearing.
 */
export function ScoreBadge({ score, className = '' }) {
  if (score == null) return null

  const tone =
    score >= 80 ? 'success' : score >= 60 ? 'brand' : score >= 40 ? 'warning' : 'neutral'

  return (
    <span className={`badge ${TONES[tone]} ${className}`}>
      <svg
        className="mr-1 h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      {score}% match
    </span>
  )
}

/**
 * The unread count pill.
 *
 * Caps at "99+" — an unbounded number blows out the layout of a nav item.
 * The full count is still in the accessible label.
 */
export function CountBadge({ count, className = '', max = 99 }) {
  if (!count) return null
  return (
    <span
      className={`count-badge bg-brand-600 text-white ${className}`}
    >
      <span aria-hidden="true">{count > max ? `${max}+` : count}</span>
      <span className="sr-only">{count} unread</span>
    </span>
  )
}
