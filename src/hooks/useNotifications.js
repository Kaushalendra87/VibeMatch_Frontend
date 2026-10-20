/**
 * Notifications.
 *
 * **Fully backed.** The realtime half pushes `notification.push` and
 * `notification.count` frames onto the socket, and the consumer seeds an
 * unread count in its `ready` frame — so the bell's badge is live. The
 * REST half is real too: `notifications/urls.py` serves the list, the
 * unread count, mark-read, mark-all-read, the preferences and the
 * banners.
 *
 * An earlier version of this comment said the list endpoint did not exist
 * yet and treated a 404 as the expected case. That was true when it was
 * written and stopped being true when the views landed — the 404 branch
 * was dead code that would have swallowed a genuine routing failure as
 * "coming soon". `isUnavailable` is gone with it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrapPage } from '../services/client'
import { queryKeys } from './queryKeys'

export async function fetchNotifications({ page = 1, unreadOnly = false } = {}) {
  const params = { page }
  if (unreadOnly) params.unread = true
  const response = await api.get('/notifications/', { params })
  return unwrapPage(response)
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.post(`/notifications/${notificationId}/read/`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all/')
  return data
}

/**
 * The notification list.
 *
 * `enabled` is driven by the bell's open state — there is no reason to
 * fetch a list nobody is looking at, and the badge comes from the socket.
 */
export function useNotifications({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => fetchNotifications({ page: 1 }),
    enabled,
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 2,
  })

  return {
    notifications: query.data?.results ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    markAllRead: async () => {
      await markAllNotificationsRead().catch(() => {})
      query.refetch()
    },
    isMarkingAllRead: false,
  }
}

/**
 * The notification list, paged.
 *
 * Separate from `useNotifications` rather than a `page` argument on it.
 * That hook is the bell's: it always reads page 1 and is enabled only
 * while the dropdown is open, and giving it a page would mean the bell and
 * the full page shared a cache entry keyed on different pages — closing
 * the bell would leave the page showing page 1 under a page-3 heading.
 *
 * The key includes the page, so each page caches independently and the
 * pagination controls cannot disagree with the rows beneath them.
 */
export function usePagedNotifications({ page = 1, enabled = true } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.notifications({ page }),
    queryFn: () => fetchNotifications({ page }),
    enabled,
    // Keep the previous page on screen while the next one loads, so the
    // list does not collapse to a skeleton on every page change.
    placeholderData: (previous) => previous,
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 2,
  })

  return {
    notifications: query.data?.results ?? [],
    count: query.data?.count ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    markAllRead: async () => {
      await markAllNotificationsRead().catch(() => {})
      // Both keys, or the bell's cached page 1 keeps its unread tint.
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  }
}

/** Mark one notification read, optimistically. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueriesData({ queryKey: ['notifications'] })

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (existing) => {
        if (!existing?.results) return existing
        return {
          ...existing,
          results: existing.results.map((item) =>
            item.id === notificationId ? { ...item, is_read: true } : item,
          ),
        }
      })

      // Returned so `onError` can put it back.
      return { previous }
    },
    onError: (_error, _id, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() })
    },
  })
}

// ── Delivery preferences ─────────────────────────────────────────────

/**
 * The per-kind delivery switches.
 *
 * The server returns a row for **every** kind, not just the ones this
 * user has changed, and marks the untouched ones `is_default: true` —
 * `NotificationPreference` stores only deviations, so a naive list would
 * show an almost-empty screen.
 */
export async function fetchNotificationPreferences() {
  const { data } = await api.get('/notifications/preferences/')
  return data
}

/**
 * Update one kind.
 *
 * `kind` is in the body rather than the URL because the row may not exist
 * yet — the view creates it on first change, so there is no POST-then-
 * PATCH dance and no id to address.
 */
export async function updateNotificationPreference({ kind, ...changes }) {
  const { data } = await api.patch('/notifications/preferences/', { kind, ...changes })
  return data
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences(),
    queryFn: fetchNotificationPreferences,
    // These change only from this screen, which invalidates explicitly.
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNotificationPreference,
    onSuccess: (updated) => {
      // Patch the one row in place rather than refetching the list: the
      // server echoes the saved row, and a full refetch on every toggle
      // makes a switch flicker as it round-trips.
      queryClient.setQueryData(queryKeys.notificationPreferences(), (existing) => {
        if (!Array.isArray(existing)) return existing
        return existing.map((row) =>
          row.kind === updated.kind ? { ...row, ...updated, is_default: false } : row,
        )
      })
    },
  })
}
