/**
 * A profile's photos as a square grid that opens the full-screen viewer.
 *
 * ## One viewer per grid, not one per tile
 *
 * The obvious shape is a `PhotoViewer` inside each tile, opened by that
 * tile's own state. That would mount eight dialogs and eight key
 * listeners for a page that can only ever show one — and, worse, each
 * one's "next" would be its own index rather than a position in the set.
 * Here the grid owns a single `viewerIndex`, and the viewer is a sibling
 * of the grid.
 *
 * `viewerIndex === null` means closed. That is deliberate rather than a
 * separate `isOpen` boolean: two pieces of state for one concept can
 * disagree, and "which photo is open" already answers "is one open".
 *
 * ## Moderation
 *
 * The API exposes `moderation_status`, and a photo can be `pending` or
 * `rejected` while still being returned to its owner. Those are excluded
 * from the *public* grid by the server; on your own profile they are
 * returned and shown, but a viewer who sees them needs to know why a
 * picture they just uploaded is not on their profile yet. `showStatus`
 * adds that label — the owner's grid sets it, the public one does not.
 *
 * ## Keyboard
 *
 * Each tile is a real `<button>`, so Enter and Space open the viewer and
 * Tab reaches every photo in order. The viewer's own arrow keys are bound
 * on the dialog, so they do not fight the grid.
 */

import { useCallback, useState } from 'react'

import { PhotoViewer } from '../ui/PhotoViewer'
import { EmptyState } from '../ui/States'

/** Copy for the moderation states, as shown to the owner. */
const MODERATION_LABELS = {
  pending: 'In review',
  rejected: 'Not approved',
  flagged: 'In review',
}

export function PhotoGrid({
  photos = [],
  name = 'This member',
  showStatus = false,
  className = '',
  emptyTitle = 'No photos yet',
  emptyDescription = 'Photos are what people see first.',
}) {
  const [viewerIndex, setViewerIndex] = useState(null)

  const closeViewer = useCallback(() => setViewerIndex(null), [])

  if (photos.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    )
  }

  return (
    <>
      <ul
        className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 ${className}`}
      >
        {photos.map((photo, index) => {
          const statusLabel =
            showStatus && photo.moderation_status && photo.moderation_status !== 'approved'
              ? MODERATION_LABELS[photo.moderation_status] ?? photo.moderation_status
              : null

          return (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                // The button's own label says what activating it does, and
                // names the photo — the image inside is decorative because
                // this label already carries its content.
                aria-label={
                  photo.caption
                    ? `Open photo ${index + 1} of ${photos.length}: ${photo.caption}`
                    : `Open ${name}'s photo ${index + 1} of ${photos.length}`
                }
                className="group relative block h-full w-full overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-slate-800"
              >
                <img
                  src={photo.url}
                  // Decorative *here*: the button above already carries the
                  // caption and the position, so a real alt would have a
                  // screen reader announce the same photo twice. The viewer
                  // is where the image is the content, and it sets a real
                  // alt.
                  alt=""
                  loading={index < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="aspect-square h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.03]"
                />

                {photo.is_primary ? (
                  <span className="chip-on-photo absolute left-2 top-2">Main</span>
                ) : null}

                {statusLabel ? (
                  <span className="chip-on-photo absolute right-2 top-2">
                    {statusLabel}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {viewerIndex != null ? (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={closeViewer}
        />
      ) : null}
    </>
  )
}
