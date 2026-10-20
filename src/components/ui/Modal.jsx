/**
 * An accessible modal dialog.
 *
 * Built on the native `<dialog>` element rather than a div overlay, which
 * gets three things for free that are easy to get wrong by hand: focus
 * trapping, restoring focus to the trigger on close, and inerting the
 * rest of the page for assistive technology. `showModal()` is what
 * enables all three.
 *
 * Escape and the backdrop close it, unless `dismissible` is false — a
 * destructive confirmation that can be dismissed by a stray click is a
 * way to lose data.
 */

import { useEffect, useRef } from 'react'

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // `cancel` fires on Escape. Preventing it is the only way to make the
  // dialog genuinely non-dismissible — a keydown handler would race the
  // browser's own handling.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    const onCancel = (event) => {
      if (!dismissible) {
        event.preventDefault()
        return
      }
      onClose?.()
    }
    // `close` fires after `close()` or a native dismissal, keeping the
    // parent's state in step with the element's.
    const onNativeClose = () => onClose?.()

    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onNativeClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onNativeClose)
    }
  }, [dismissible, onClose])

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      // Clicking the backdrop lands on the dialog element itself, since
      // the content sits in a child. That is the check below.
      onClick={(event) => {
        if (dismissible && event.target === dialogRef.current) onClose?.()
      }}
      className={[
        'w-[calc(100vw-2rem)] surface-overlay p-0 backdrop:bg-slate-900/50',
        'text-slate-900 dark:text-slate-100',
        sizeClass,
      ].join(' ')}
    >
      <div className="flex max-h-[85vh] flex-col">
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-sand-200 p-5 dark:border-sand-700">
            <div>
              <h2
                id="modal-title"
                className="heading-section"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                >
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
            ) : null}
          </div>
        ) : null}

        <div className="scrollbar-thin overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-3 border-t border-sand-200 p-5 dark:border-sand-700">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  )
}

/**
 * A confirmation dialog for a destructive action.
 *
 * Separate from `Modal` because the pattern — irreversible action, a
 * specific verb on the button, `dismissible={false}` while the request is
 * in flight — is repeated often enough to be worth not re-deriving.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isPending = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      // While the request is in flight, dismissing would leave the caller
      // unable to report the outcome.
      dismissible={!isPending}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </Modal>
  )
}
