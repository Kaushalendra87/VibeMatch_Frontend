/**
 * A full-screen photo viewer.
 *
 * ## Why this is not a `Modal` size variant
 *
 * `Modal` is a card: `surface-overlay`, a title bar, a padded body capped
 * at `85vh`, and a light surface in both themes. A photo viewer is the
 * opposite of all four — full-bleed, untitled, uncapped, and dark in both
 * themes, because a light chrome around a photograph shifts how its
 * colours read. Forcing one component to be both would mean four flags
 * that always travel together.
 *
 * It is still built on the same primitive, native `<dialog>` with
 * `showModal()`, so focus trapping, focus restoration to the trigger, and
 * inerting the page for assistive tech all come from the browser rather
 * than from hand-written handlers — one dialog pattern in the codebase,
 * two skins.
 *
 * ## Keyboard
 *
 * Left/Right page through the photos, Home/End jump to the ends, Escape
 * closes (native). The arrow keys are bound on the dialog element, so they
 * only apply while it is open and the page's own scrolling is unaffected
 * when it is not.
 *
 * ## Counter and caption
 *
 * The position is announced as text ("3 of 8") rather than as a row of
 * dots: dots are unreadable to a screen reader without extra work, and a
 * count is what a person actually wants when deciding whether to keep
 * paging.
 */

import { useCallback, useEffect, useRef } from 'react'

export function PhotoViewer({
  photos = [],
  index = 0,
  onIndexChange,
  onClose,
  isOpen = true,
}) {
  const dialogRef = useRef(null)
  const photo = photos[index]
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    else if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const onNativeClose = () => onClose?.()
    dialog.addEventListener('close', onNativeClose)
    return () => dialog.removeEventListener('close', onNativeClose)
  }, [onClose])

  const go = useCallback(
    (next) => {
      if (next < 0 || next >= photos.length) return
      onIndexChange?.(next)
    },
    [photos.length, onIndexChange],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(index - 1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(index + 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        go(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        go(photos.length - 1)
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => dialog.removeEventListener('keydown', onKeyDown)
  }, [go, index, photos.length])

  if (!photo) return null

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      // A click on the backdrop lands on the dialog itself; the content
      // sits in children, so this is how a backdrop click is detected.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose?.()
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/90"
    >
      <div className="flex h-full w-full flex-col bg-slate-950/95">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
          <p className="text-sm font-medium tabular-nums" aria-hidden="true">
            {index + 1} of {photos.length}
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* The image sits in a click-through area: clicking the dark space
            around it closes, clicking the photo itself does not. */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
          {hasPrev ? (
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="absolute left-2 z-10 rounded-full bg-slate-900/60 p-2.5 text-white transition-colors hover:bg-slate-900/85 sm:left-4"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          ) : null}

          <img
            src={photo.url}
            alt={photo.caption || `Photo ${index + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain"
            // The photo is the point of the screen; nothing else competes.
            onClick={(event) => event.stopPropagation()}
          />

          {hasNext ? (
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="absolute right-2 z-10 rounded-full bg-slate-900/60 p-2.5 text-white transition-colors hover:bg-slate-900/85 sm:right-4"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>

        {photo.caption ? (
          <p className="px-4 pb-6 pt-2 text-center text-sm text-white/80">
            {photo.caption}
          </p>
        ) : (
          <div className="pb-6" />
        )}
      </div>
    </dialog>
  )
}
