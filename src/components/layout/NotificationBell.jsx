/**
 * The notification bell.
 *
 * The unread count comes from the socket's `ready` and `notification.count`
 * frames rather than a poll — the server pushes a count frame after every
 * push precisely so the badge does not need one. The panel fetches the
 * list over HTTP, because that is the transport that paginates and is
 * permission-checked like every other read.
 */

import { useEffect, useRef, useState } from 'react'

import { NotificationRow } from '../notifications/NotificationRow'
import { CountBadge } from '../ui/Badge'
import { EmptyState, ErrorState } from '../ui/States'
import { Spinner } from '../ui/Spinner'
import { useRealtime } from '../../context/RealtimeContext'
import { useNotifications } from '../../hooks/useNotifications'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const { unreadNotifications, setUnreadNotifications } = useRealtime()
  const {
    notifications,
    isLoading,
    isError,
    error,
    refetch,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications({ enabled: isOpen })

  // Close on an outside click or Escape. A dropdown that traps the user
  // with no way out is worse than one that closes too eagerly.
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen((current) => !current)
  }

  const handleMarkAllRead = async () => {
    await markAllRead()
    // Clear the badge immediately; the socket will confirm with a count
    // frame, but waiting for it would leave the dot lit for a moment.
    setUnreadNotifications(0)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={
          unreadNotifications
            ? `Notifications, ${unreadNotifications} unread`
            : 'Notifications'
        }
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-sand-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-sand-800 dark:hover:text-slate-200"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          />
        </svg>
        <CountBadge
          count={unreadNotifications}
          className="absolute -right-0.5 -top-0.5"
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-80 origin-top-right animate-fade-in overflow-hidden surface-overlay dark:border-sand-800 dark:bg-sand-900 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3 dark:border-sand-800">
            <h2 className="heading-section">
              Notifications
            </h2>
            {unreadNotifications > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400"
              >
                {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
              </button>
            ) : null}
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : isError ? (
              <ErrorState error={error} onRetry={refetch} className="py-8" />
            ) : notifications.length === 0 ? (
              <EmptyState
                title="No notifications"
                description="Likes, matches and messages will show up here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-sand-100 dark:divide-sand-800">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onNavigate={() => setIsOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
