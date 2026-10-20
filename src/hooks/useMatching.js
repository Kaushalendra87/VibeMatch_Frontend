/**
 * Discovery, likes and matches.
 *
 * The optimistic updates here are the most delicate part of the app, so
 * the rule is: **optimistic for the feed, never for the likes list.** A
 * like advances the feed immediately (the card is gone either way), but
 * the likes tabs are server-derived — a `received` tab cannot be
 * optimistically updated at all, because the current user is not the one
 * acting. Mixing the two would produce a list that briefly shows rows
 * that do not exist.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as matchingApi from '../services/matching'
import { useRealtime } from '../context/RealtimeContext'
import { queryKeys } from './queryKeys'

// ── Discovery ────────────────────────────────────────────────────────
export function useDiscoveryFeed(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.feed(filters),
    queryFn: () => matchingApi.fetchDiscoveryFeed(filters),
    // The feed is scored against live activity, so it goes stale quickly.
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
    ...options,
  })
}

/**
 * The like quota, for the counter in the feed header.
 *
 * Polled less often than the feed because it only resets daily, and
 * refreshed on every like via the mutation's response.
 */
export function useLikeQuota() {
  return useQuery({
    queryKey: queryKeys.likeQuota(),
    queryFn: matchingApi.fetchLikeQuota,
    staleTime: 60 * 1000,
  })
}

/**
 * Record a verdict.
 *
 * The returned payload carries `quota`, `is_new_match` and the match
 * itself, so the caller gets everything the "it's a match" screen needs
 * without a follow-up request.
 */
export function useSendLike() {
  const queryClient = useQueryClient()
  const { invalidateEverywhere } = useRealtime()

  return useMutation({
    mutationFn: ({ userId, kind = 'like', message = '' }) =>
      matchingApi.sendLike(userId, kind, message),
    onSuccess: (result, variables) => {
      // The server tells us the new allowance; trust it over arithmetic.
      if (result.quota) {
        queryClient.setQueryData(queryKeys.likeQuota(), result.quota)
      }

      // Remove the card from every cached feed variant. A `pass` and a
      // `like` both remove it from view — the difference is what the
      // other person sees.
      queryClient.setQueriesData({ queryKey: ['feed'] }, (existing) => {
        if (!existing?.results) return existing
        return {
          ...existing,
          results: existing.results.filter(
            (card) => card.user_id !== variables.userId,
          ),
          count: Math.max(0, (existing.count ?? 1) - 1),
        }
      })

      // A new match changes the match list, and the other person's like
      // may have already been sitting in the likes tabs.
      //
      // Invalidated *everywhere*, not just here: a match is the one piece
      // of state a user is most likely to be watching in two tabs at
      // once (the feed in one, the match list in the other). The server
      // also pushes `match.created` to this user's socket, which covers
      // the same ground from the other direction — belt and braces, and
      // the refetch is deduplicated by React Query.
      if (result.is_new_match) {
        invalidateEverywhere([
          ['matches'],
          ['likes'],
          queryKeys.notificationCount(),
        ])
      }
    },
  })
}

/** Undo a verdict, returning the person to the feed. */
export function useRewindLike() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: matchingApi.rewindLike,
    onSuccess: () => {
      // Rewinding cannot be patched locally — the server decides where
      // the card re-enters the scored ordering.
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.likeQuota() })
      queryClient.invalidateQueries({ queryKey: ['likes'] })
    },
  })
}

// ── Likes ────────────────────────────────────────────────────────────
export function useLikes(tab = 'received', page = 1, options = {}) {
  return useQuery({
    queryKey: queryKeys.likes(tab, page),
    queryFn: () => matchingApi.fetchLikes({ tab, page }),
    placeholderData: (previous) => previous,
    ...options,
  })
}

// ── Matches ──────────────────────────────────────────────────────────
export function useMatches(page = 1, status, options = {}) {
  return useQuery({
    queryKey: queryKeys.matches(page, status),
    queryFn: () => matchingApi.fetchMatches({ page, status }),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useMatch(matchId) {
  return useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => matchingApi.fetchMatch(matchId),
    enabled: Boolean(matchId),
  })
}

export function useUnmatch() {
  const queryClient = useQueryClient()
  const { invalidateEverywhere } = useRealtime()

  return useMutation({
    mutationFn: matchingApi.unmatch,
    onSuccess: (_data, matchId) => {
      queryClient.removeQueries({ queryKey: queryKeys.match(matchId) })
      // An unmatch closes the conversation server-side, so the chat list
      // is now wrong too. Both go out to the other tabs — the match list
      // open in a second tab is otherwise the last place to find out.
      invalidateEverywhere([['matches'], ['conversations']])
    },
  })
}

// ── Scoring configuration (admin) ────────────────────────────────────
/**
 * The scorer's weights and thresholds.
 *
 * Read-only for ordinary users — the endpoint is `IsAdmin` for writes but
 * readable more widely, so this hook is safe to call from anywhere and
 * only the editor behind it is gated.
 */
export function useMatchingConfig(options = {}) {
  return useQuery({
    queryKey: queryKeys.matchingConfig(),
    queryFn: matchingApi.fetchMatchingConfig,
    // Weights change only when an admin edits them, and the cost of
    // being briefly stale is that one save round-trips a stale draft.
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * Save a partial config.
 *
 * **The feed is invalidated, not just the config.** Every cached
 * discovery page was ordered by the old weights, so leaving it in place
 * would show the admin a feed that no longer matches the settings they
 * just saved. The config itself is refetched so the form shows what was
 * actually stored rather than what was typed.
 */
export function useUpdateMatchingConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: matchingApi.updateMatchingConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matchingConfig() })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
