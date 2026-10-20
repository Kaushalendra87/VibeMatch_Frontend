/**
 * A user's photo, with an initials fallback.
 *
 * The online dot is driven by the `isOnline` prop rather than being read
 * from the object, because the same person can be online in one payload
 * and not in another — the match list and the chat list both carry the
 * flag, and a live `presence` frame can change it after render.
 */

import { useState } from 'react'

import { initials } from '../../utils/format'

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-4xl',
}

/** Dot sizes that look right against each avatar size. */
const DOT_CLASSES = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3.5 w-3.5',
  xl: 'h-5 w-5',
  '2xl': 'h-6 w-6',
}

export function Avatar({
  src,
  name,
  size = 'md',
  isOnline = false,
  showOnlineDot = false,
  className = '',
  ring = false,
}) {
  // A broken image URL should fall back to initials rather than showing
  // the browser's broken-image glyph.
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md
  const showImage = src && !failed

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={[
          sizeClass,
          'flex items-center justify-center overflow-hidden rounded-full',
          'bg-slate-200 font-semibold text-slate-600',
          'dark:bg-slate-700 dark:text-slate-300',
          ring ? 'ring-2 ring-white dark:ring-slate-900' : '',
        ].join(' ')}
      >
        {showImage ? (
          <img
            src={src}
            alt={name ? `${name}` : ''}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initials(name)}</span>
        )}
      </div>

      {showOnlineDot ? (
        <span
          className={[
            'absolute bottom-0 right-0 rounded-full ring-2',
            'ring-white dark:ring-slate-900',
            DOT_CLASSES[size] ?? DOT_CLASSES.md,
            isOnline ? 'bg-sage-500' : 'bg-slate-400 dark:bg-slate-600',
          ].join(' ')}
          // The dot is decorative; the text alternative is provided by the
          // caller where it matters (e.g. the chat header).
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
