/**
 * The VibeMatch logo.
 *
 * ## The mark
 *
 * Two arcs that begin wide apart and converge on a single point: two
 * paths meeting. The primary read is a **V**, and the outward bow of each
 * arc leaves the **M** in the silhouette — the two capitals in "VibeMatch"
 * echo it, which is why the wordmark keeps its internal capital.
 *
 * Drawn as one continuous stroked path rather than two, so the vertex is a
 * real round join instead of two round caps meeting and leaving a seam.
 *
 * ## Why it is monochrome
 *
 * The mark is `currentColor`, not a two-tone rose-and-sage pairing. The
 * palette rules reserve rose for actions and sage for positive states, and
 * a logo that spends both on decoration would undercut that. Monochrome
 * also means the mark inherits whichever brand step its container sets and
 * needs no separate dark-mode variant.
 *
 * ## Sizes
 *
 * The geometry is tuned for the 16px favicon as much as for the 24px
 * sidebar: two strokes and one vertex survive downscaling, where a
 * detailed mark would silt up. `LogoMark` is the whole logo at that size —
 * see `public/favicon.svg`, which is this path on a solid tile.
 */

/** Single continuous path: down from top-left, vertex, back up to top-right. */
const MARK_PATH = 'M 4.4 5.2 Q 6.2 11.6 12 18.6 Q 17.8 11.6 19.6 5.2'

/** Mark and wordmark scale together, so the lockup never looks mismatched. */
const SIZES = {
  sm: { mark: 'h-5 w-5', text: 'text-base' },
  md: { mark: 'h-6 w-6', text: 'text-lg' },
  lg: { mark: 'h-8 w-8', text: 'text-2xl' },
}

/**
 * The mark on its own — no wordmark.
 *
 * Use where the brand is already established or space is tight: the
 * collapsed sidebar, a mobile header, a loading screen.
 */
export function LogoMark({ size = 'md', className = '' }) {
  const { mark } = SIZES[size] ?? SIZES.md
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${mark} ${className}`}
      aria-hidden="true"
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Mark plus the "VibeMatch" wordmark.
 *
 * The wordmark is set in Fraunces (`font-display`) — the same face the
 * page headings use, so the brand and the editorial type agree.
 *
 * `as="span"` renders it inert, for when a parent already handles the
 * link and a nested anchor would be invalid.
 */
export function Logo({
  size = 'md',
  withMark = true,
  as = 'span',
  className = '',
  markClassName = '',
}) {
  const { text } = SIZES[size] ?? SIZES.md
  const Tag = as

  return (
    <Tag
      className={[
        'inline-flex items-center gap-2 font-display font-semibold tracking-tight',
        text,
        className,
      ].join(' ')}
    >
      {withMark ? <LogoMark size={size} className={markClassName} /> : null}
      <span>VibeMatch</span>
    </Tag>
  )
}
