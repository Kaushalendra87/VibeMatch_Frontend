/**
 * Notifications — the full list.
 *
 * The bell's dropdown already renders these rows; this page exists because
 * a dropdown is a glance, not a place. It caps at a scroll box with no
 * paging, so a user who has been away for a week cannot reach the older
 * half of their notifications at all. The list endpoint paginates, so this
 * page does too.
 *
 * ## The unread count is not fetched here
 *
 * It arrives on the socket (`unreadNotifications`), the same source the
 * bell reads. Reading it from this page's own query would give two numbers
 * that can disagree — the page would show a stale count for as long as its
 * query was cached while the bell showed the pushed one.
 *
 * Rows come from `NotificationRow`, shared with the bell, so both render
 * the same record identically.
 */

import { useState } from 'react'

import { NotificationRow } from '../../components/notifications/NotificationRow'
import { Pagination } from '../../components/ui/Pagination'
import { EmptyState, RowListSkeleton, QueryState } from '../../components/ui/States'
import { useRealtime } from '../../context/RealtimeContext'
import { usePagedNotifications } from '../../hooks/useNotifications'

export function NotificationsPage() {
  const [page, setPage] = useState(1)
  const { unreadNotifications, setUnreadNotifications } = useRealtime()
  const {
    notifications,
    count,
    totalPages,
    isLoading,
    isError,
    error,
    refetch,
    markAllRead,
  } = usePagedNotifications({ page })

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-display">Notifications</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Likes, matches, messages and account activity.
          </p>
        </div>

        {unreadNotifications > 0 ? (
          <button
            type="button"
            onClick={async () => {
              await markAllRead()
              setUnreadNotifications(0)
            }}
            className="btn-secondary text-sm"
          >
            Mark all read
          </button>
        ) : null}
      </header>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        skeleton={<RowListSkeleton count={8} />}
        isEmpty={notifications.length === 0}
        emptyTitle="No notifications yet"
        emptyDescription="When someone likes you, matches with you or sends a message, it will appear here."
      >
        <>
          <ul className="card divide-y divide-sand-100 p-0 dark:divide-sand-800">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow notification={notification} />
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            count={count}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      </QueryState>
    </div>
  )
}
