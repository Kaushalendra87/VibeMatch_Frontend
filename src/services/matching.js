/**
 * Discovery, likes and matches.
 *
 * A note on ids, because it is the easiest mistake to make here: the
 * discovery feed returns **both** `id` (the Profile UUID) and `user_id`
 * (the integer User pk). Likes are addressed by `user_id`. The profile
 * UUID is for the profile page. Sending a profile UUID to the like
 * endpoint is a 404 that reads like a permissions failure.
 */

import { api, unwrapPage } from './client'

/**
 * The scored candidate feed.
 *
 * These filters narrow an already-legal candidate set — the user's saved
 * preferences are deal-breakers the server applies first, so a filter
 * here can only remove people, never reveal ones their preferences
 * exclude.
 *
 * `min_score` is 0-100, matching what the UI displays. The server also
 * accepts 0-1 and scales it, but there is no reason to use that here.
 */
export async function fetchDiscoveryFeed({
  page = 1,
  pageSize,
  minAge,
  maxAge,
  maxDistanceKm,
  genders,
  interests,
  goals,
  minScore,
  ordering = 'score',
} = {}) {
  const params = { page, ordering }
  if (pageSize) params.page_size = pageSize
  if (minAge != null) params.min_age = minAge
  if (maxAge != null) params.max_age = maxAge
  if (maxDistanceKm != null) params.max_distance_km = maxDistanceKm
  // The server parses these as comma-separated values.
  if (genders?.length) params.gender = genders.join(',')
  if (interests?.length) params.interests = interests.join(',')
  if (goals?.length) params.relationship_goal = goals.join(',')
  if (minScore != null) params.min_score = minScore

  const response = await api.get('/matches/discover/', { params })
  return unwrapPage(response)
}

/**
 * Record a verdict on someone.
 *
 * Returns the match inline when the like completed a mutual pair, so the
 * "it's a match" screen does not need a second request.
 *
 * Idempotent: re-sending the same verdict returns 200 rather than 201 and
 * `is_new_match: false`, so a retry on a flaky connection cannot produce
 * a duplicate celebration.
 */
export async function sendLike(userId, kind = 'like', message = '') {
  const { data } = await api.post('/matches/likes/create/', {
    user_id: userId,
    kind,
    message,
  })
  return data
}

/**
 * The likes lists, split by tab.
 *
 * `received` is the tab a paid plan unlocks — a free user gets the count
 * but the server withholds the people, so the UI must handle an empty
 * list that is not actually empty.
 */
export async function fetchLikes({ tab = 'received', page = 1, pageSize } = {}) {
  const params = { tab, page }
  if (pageSize) params.page_size = pageSize
  const response = await api.get('/matches/likes/', { params })
  return unwrapPage(response)
}

/** Today's remaining like allowance, for the counter. */
export async function fetchLikeQuota() {
  const { data } = await api.get('/matches/likes/quota/')
  return data
}

/** Undo a verdict, returning the person to the feed. Addressed by user id. */
export async function rewindLike(userId) {
  await api.delete(`/matches/likes/${userId}/`)
}

/** The user's matches. `status` defaults to `active` server-side. */
export async function fetchMatches({ page = 1, pageSize, status } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  const response = await api.get('/matches/', { params })
  return unwrapPage(response)
}

/** One match with the counterpart's full public profile. */
export async function fetchMatch(matchId) {
  const { data } = await api.get(`/matches/${matchId}/`)
  return data
}

/**
 * Unmatch. The row is kept for history, so the match stops showing
 * without the other person being notified of a deletion.
 */
export async function unmatch(matchId) {
  await api.delete(`/matches/${matchId}/`)
}

/** The scoring weights. Readable by any authenticated user, admin-writable. */
export async function fetchMatchingConfig() {
  const { data } = await api.get('/matches/config/')
  return data
}

export async function updateMatchingConfig(payload) {
  const { data } = await api.patch('/matches/config/', payload)
  return data
}
