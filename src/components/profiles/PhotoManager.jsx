/**
 * The photo manager.
 *
 * Reordering is drag-and-drop **and** keyboard-operable. A drag-only
 * reorder is unusable without a pointer, so each tile also has explicit
 * "move earlier"/"move later" buttons — which is more code than a library
 * would be, but a library that only does pointer events would leave the
 * feature unreachable.
 *
 * The order is sent as the **complete** list of photo ids, because the
 * server assigns positions from the array index. That also means the
 * local order is authoritative during a drag and must be rolled back if
 * the request fails — otherwise the grid shows an order the server does
 * not have.
 *
 * Moderation is surfaced rather than hidden: a pending photo is visible
 * to its owner with a "under review" label, and a rejected one says why.
 * A photo that silently never appears on the profile is the single most
 * confusing thing that can happen here.
 */

import { useEffect, useRef, useState } from 'react'

import { Badge } from '../ui/Badge'
import { ConfirmDialog } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { MAX_PHOTOS, MAX_PHOTO_MB, PHOTO_MODERATION } from '../../utils/constants'

const MODERATION_BADGE = {
  [PHOTO_MODERATION.PENDING]: { tone: 'warning', label: 'Under review' },
  [PHOTO_MODERATION.REJECTED]: { tone: 'danger', label: 'Rejected' },
}

function PhotoTile({
  photo,
  index,
  total,
  onSetPrimary,
  onDelete,
  onMove,
  isBusy,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}) {
  const moderation = MODERATION_BADGE[photo.moderation_status]

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={[
        'group relative overflow-hidden rounded-lg border',
        photo.is_primary
          ? 'border-brand-500 ring-1 ring-brand-500'
          : 'border-sand-200 dark:border-sand-800',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <img
        src={photo.thumbnail_url || photo.url}
        alt={photo.caption || `Photo ${index + 1}`}
        className="aspect-square w-full object-cover"
      />

      <div className="absolute left-2 top-2 flex flex-col gap-1">
        {photo.is_primary ? <Badge tone="brand">Main</Badge> : null}
        {moderation ? <Badge tone={moderation.tone}>{moderation.label}</Badge> : null}
      </div>

      {/* The overlay is always in the DOM so it is reachable by keyboard;
          it is only *visually* revealed on hover/focus. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-1 bg-slate-900/70 p-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!photo.is_primary && photo.moderation_status === PHOTO_MODERATION.APPROVED ? (
          <button
            type="button"
            onClick={() => onSetPrimary(photo.id)}
            disabled={isBusy}
            className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-white"
          >
            Make main
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onMove(index, index - 1)}
          disabled={isBusy || index === 0}
          aria-label={`Move photo ${index + 1} earlier`}
          className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-white disabled:opacity-40"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index + 1)}
          disabled={isBusy || index === total - 1}
          aria-label={`Move photo ${index + 1} later`}
          className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-white disabled:opacity-40"
        >
          →
        </button>

        <button
          type="button"
          onClick={() => onDelete(photo)}
          aria-label={`Delete photo ${index + 1}`}
          className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-red-600 hover:bg-white"
        >
          Delete
        </button>
      </div>

      {photo.moderation_reason && photo.moderation_status === PHOTO_MODERATION.REJECTED ? (
        <p className="bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {photo.moderation_reason}
        </p>
      ) : null}
    </li>
  )
}

export function PhotoManager({
  photos = [],
  onUpload,
  onDelete,
  onSetPrimary,
  onReorder,
  isBusy = false,
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const fileInputRef = useRef(null)

  // Local mirror of the server order, so a drag renders instantly. Synced
  // from props whenever the server's list actually changes.
  const [order, setOrder] = useState(photos)
  const signature = photos.map((photo) => photo.id).join(',')
  useEffect(() => {
    setOrder(photos)
    // Keyed on the id list, not the array identity — a refetch returns a
    // new array with the same content, and resetting on that would fight
    // a drag in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const atLimit = order.length >= MAX_PHOTOS

  const upload = async (file) => {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Only image files can be uploaded.')
      return
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`Photos must be under ${MAX_PHOTO_MB} MB.`)
      return
    }
    if (atLimit) {
      setError(`You can have at most ${MAX_PHOTOS} photos.`)
      return
    }

    setProgress(1)
    try {
      await onUpload(file, setProgress)
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(0)
    }
  }

  const onFileChange = (event) => {
    const file = event.target.files?.[0]
    // Reset so re-picking the same file still fires `change`.
    event.target.value = ''
    if (file) upload(file)
  }

  const onDropFile = (event) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  /** Commit a locally-reordered list, rolling back if the server refuses. */
  const commitOrder = async (next) => {
    const previous = order
    setOrder(next)
    try {
      await onReorder(next.map((photo) => photo.id))
    } catch (err) {
      setOrder(previous)
      setError(err.message)
    }
  }

  const move = (from, to) => {
    if (to < 0 || to >= order.length) return
    const next = order.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commitOrder(next)
  }

  const onTileDrop = (targetIndex) => (event) => {
    event.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    move(dragIndex, targetIndex)
    setDragIndex(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await onDelete(pendingDelete.id)
      setPendingDelete(null)
    } catch (err) {
      setPendingDelete(null)
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="heading-section">
            Photos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {order.length} of {MAX_PHOTOS}. Drag to reorder — the first photo is
            your main one.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {order.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            index={index}
            total={order.length}
            onSetPrimary={onSetPrimary}
            onDelete={setPendingDelete}
            onMove={move}
            isBusy={isBusy}
            isDragging={dragIndex === index}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onTileDrop(index)}
          />
        ))}

        {!atLimit ? (
          <li>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDraggingOver(true)
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={onDropFile}
              disabled={isBusy || progress > 0}
              className={[
                'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors',
                isDraggingOver
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60',
              ].join(' ')}
            >
              {progress > 0 ? (
                <>
                  <Spinner label="Uploading photo" />
                  <span>{progress}%</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Add a photo</span>
                </>
              )}
            </button>
          </li>
        ) : null}
      </ul>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="sr-only"
        aria-label="Upload a photo"
      />

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Photos are reviewed before they appear on your profile, and metadata
        (including location) is stripped on upload.
      </p>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this photo?"
        description="It will be removed from your profile immediately. This cannot be undone."
        confirmLabel="Delete"
        isDestructive
        isPending={isBusy}
      />
    </div>
  )
}
