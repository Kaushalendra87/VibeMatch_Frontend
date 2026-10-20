/**
 * The admin API.
 *
 * Everything here lives under `/admin/` on the server, which is a
 * different prefix from `/reports/` on purpose: `/reports/` is
 * self-scoped and reachable by any signed-in user, `/admin/` carries
 * `IsModerator` or `IsAdmin` on every route. The two must not be
 * confused, so this module never calls a non-admin endpoint.
 *
 * **Two read shapes, and they differ.** The list endpoints are
 * page-number paginated and go through `unwrapPage`. The analytics
 * endpoints return a bare array or object — `pagination_class = None` —
 * so they are returned as-is. Wrapping those in `unwrapPage` would find
 * no `.results` and hand back an empty list, which reads as "no data"
 * rather than "wrong unwrapper".
 *
 * Money arrives in integer minor units *and* as a pre-formatted display
 * string. Both are used: the display string for anything shown to a
 * human, the minor units for arithmetic (sums, sorting). Re-deriving the
 * string from the number would mean re-implementing the server's
 * currency formatting on the client.
 */

import { api, unwrapPage } from './client'

// ── Analytics ────────────────────────────────────────────────────────
/** Headline figures for the analytics landing page. */
export async function fetchOverview() {
  const { data } = await api.get('/admin/overview/')
  return data
}

/**
 * The daily rollup over a window.
 *
 * Returns a bare array, oldest-first. Days with no rollup row are absent
 * rather than zero — see `adminpanel.services.build_timeseries`.
 */
export async function fetchTimeseries({ days = 30 } = {}) {
  const { data } = await api.get('/admin/analytics/timeseries/', { params: { days } })
  return Array.isArray(data) ? data : (data?.results ?? [])
}

/** Weekly signup cohorts and their retention. */
export async function fetchCohorts({ weeks = 8 } = {}) {
  const { data } = await api.get('/admin/analytics/cohorts/', { params: { weeks } })
  return Array.isArray(data) ? data : (data?.results ?? [])
}

// ── Users ────────────────────────────────────────────────────────────
/**
 * The user table.
 *
 * `ordering` is an allow-list server-side; sending a field it does not
 * recognise is ignored rather than a 500, so a stale option here
 * degrades to the default order instead of breaking the page.
 */
export async function fetchUsers({
  page = 1,
  pageSize,
  q,
  role,
  status,
  ordering,
  includeDeleted = false,
} = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (q) params.q = q
  if (role) params.role = role
  if (status) params.status = status
  if (ordering) params.ordering = ordering
  if (includeDeleted) params.include_deleted = true

  const response = await api.get('/admin/users/', { params })
  return unwrapPage(response)
}

export async function fetchUser(userId) {
  const { data } = await api.get(`/admin/users/${userId}/`)
  return data
}

/**
 * Change a user's role or status.
 *
 * The server refuses two things this cannot pre-empt: an admin demoting
 * themselves, and removing the last admin. Both come back as a 400 with
 * a readable message, which the caller surfaces rather than swallowing.
 */
export async function updateUser(userId, payload) {
  const { data } = await api.patch(`/admin/users/${userId}/`, payload)
  return data
}

// ── Moderation queues ────────────────────────────────────────────────
export async function fetchReportQueue({ page = 1, pageSize, status, priority, reason } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  if (priority) params.priority = priority
  if (reason) params.reason = reason
  const response = await api.get('/admin/reports/', { params })
  return unwrapPage(response)
}

export async function fetchReport(reportId) {
  const { data } = await api.get(`/admin/reports/${reportId}/`)
  return data
}

/** Take ownership of a report so two moderators do not duplicate work. */
export async function claimReport(reportId) {
  const { data } = await api.post(`/admin/reports/${reportId}/claim/`, {})
  return data
}

/**
 * Resolve a report.
 *
 * `action` is one of `none` (dismiss), `warn`, `suspend`, `ban` or
 * `content_removed`. A `suspend` or `ban` requires a non-empty `note` —
 * the server rejects it otherwise, because an unexplained account action
 * is the first thing an appeal asks about.
 */
export async function decideReport(reportId, { action, note = '', suspendDays = null }) {
  const payload = { action, note }
  if (suspendDays != null) payload.suspend_days = suspendDays
  const { data } = await api.post(`/admin/reports/${reportId}/decide/`, payload)
  return data
}

export async function fetchVerificationQueue({ page = 1, pageSize, status, kind } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  if (kind) params.kind = kind
  const response = await api.get('/admin/verifications/', { params })
  return unwrapPage(response)
}

/**
 * Approve or reject a verification.
 *
 * A rejection requires a reason — the user is told why, so "no" without
 * one is not an acceptable answer.
 */
export async function decideVerification(requestId, { decision, reason = '', notes = '' }) {
  const { data } = await api.post(`/admin/verifications/${requestId}/decide/`, {
    decision,
    reason,
    notes,
  })
  return data
}

/**
 * The photo review queue.
 *
 * Only meaningful while `auto_approve_photos` is off: with it on, uploads
 * are approved at creation and this list is empty by design. The page
 * reads the setting to say so rather than leaving the moderator to
 * wonder whether the queue is broken.
 */
export async function fetchPhotoQueue({ page = 1, pageSize, status, profile } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  if (profile) params.profile = profile
  const response = await api.get('/admin/photos/', { params })
  return unwrapPage(response)
}

/**
 * Approve or reject one photo.
 *
 * A rejection requires a reason — it is shown to the owner, and "your
 * photo was rejected" with no reason is unactionable.
 */
export async function decidePhoto(photoId, { approve, reason = '' }) {
  const { data } = await api.post(`/admin/photos/${photoId}/decide/`, {
    approve,
    reason,
  })
  return data
}

/**
 * Approve or reject several photos at once.
 *
 * Ids that are no longer pending are skipped, not failed, and the count
 * comes back in the response — the queue refreshes between page loads, so
 * a stale id is expected rather than exceptional.
 */
export async function decidePhotosBulk({ ids, approve, reason = '' }) {
  const { data } = await api.post('/admin/photos/bulk/', { ids, approve, reason })
  return data
}

/** The moderator action log — who did what, to whom. */
export async function fetchModerationLog({ page = 1, pageSize, action, targetType } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (action) params.action = action
  if (targetType) params.target_type = targetType
  const response = await api.get('/admin/moderation/log/', { params })
  return unwrapPage(response)
}

// ── Billing ──────────────────────────────────────────────────────────
export async function fetchPlans() {
  const response = await api.get('/admin/billing/plans/')
  return unwrapPage(response)
}

export async function createPlan(payload) {
  const { data } = await api.post('/admin/billing/plans/', payload)
  return data
}

export async function updatePlan(planId, payload) {
  const { data } = await api.patch(`/admin/billing/plans/${planId}/`, payload)
  return data
}

/**
 * Delete a plan.
 *
 * Refused while subscribers exist: `Subscription.plan` is `PROTECT`, so
 * deleting would orphan real subscriptions. Deactivate instead.
 */
export async function deletePlan(planId) {
  await api.delete(`/admin/billing/plans/${planId}/`)
}

export async function fetchSubscriptions({ page = 1, pageSize, status, plan, user } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  if (plan) params.plan = plan
  if (user) params.user = user
  const response = await api.get('/admin/billing/subscriptions/', { params })
  return unwrapPage(response)
}

export async function fetchPayments({ page = 1, pageSize, status, user } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (status) params.status = status
  if (user) params.user = user
  const response = await api.get('/admin/billing/payments/', { params })
  return unwrapPage(response)
}

/** Refund all or part of a payment. `amountMinor` null means the rest. */
export async function refundPayment(paymentId, { amountMinor = null, reason = '' } = {}) {
  const payload = { reason }
  if (amountMinor != null) payload.amount_minor = amountMinor
  const { data } = await api.post(`/admin/billing/payments/${paymentId}/refund/`, payload)
  return data
}

// ── Settings, flags and audit ────────────────────────────────────────
/**
 * Every site setting, ordered by group then key.
 *
 * A **bare array**, not a page. `AdminSettingListView` sets
 * `pagination_class = None` — the whole set is small and the page groups
 * it client-side, so there is nothing to paginate. Running it through
 * `unwrapPage` would look for `.results`, find none, and return `[]`,
 * which reads on screen as "no settings configured" rather than as a
 * bug. That failure mode is why this module documents the two shapes.
 */
export async function fetchSettings() {
  const { data } = await api.get('/admin/settings/')
  return Array.isArray(data) ? data : (data?.results ?? [])
}

/** Update one setting. `value` is validated against its `value_type`. */
export async function updateSetting(key, value) {
  const { data } = await api.patch(`/admin/settings/${key}/`, { value })
  return data
}

/** All flags, as a bare array of `{name, label, enabled}`. */
export async function fetchFeatureFlags() {
  const { data } = await api.get('/admin/settings/flags/')
  return Array.isArray(data) ? data : (data?.results ?? [])
}

/** Flip one flag. The server invalidates the flag cache itself. */
export async function updateFeatureFlag(name, enabled) {
  const { data } = await api.patch('/admin/settings/flags/', { name, enabled })
  return data
}

export async function fetchAuditLog({ page = 1, pageSize, action, actor, succeeded } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (action) params.action = action
  if (actor) params.actor = actor
  if (succeeded != null) params.succeeded = succeeded
  const response = await api.get('/admin/audit/', { params })
  return unwrapPage(response)
}

// ── Impersonation ────────────────────────────────────────────────────
export async function fetchImpersonationSessions({ page = 1, active } = {}) {
  const params = { page }
  if (active != null) params.active = active
  const response = await api.get('/admin/impersonation/', { params })
  return unwrapPage(response)
}

/**
 * Start impersonating a user.
 *
 * Requires a reason and is refused for another admin or while a session
 * is already open. The server writes an `AuditLog` entry either way.
 */
export async function startImpersonation(userId, reason) {
  const { data } = await api.post('/admin/impersonation/start/', {
    user_id: userId,
    reason,
  })
  return data
}

export async function endImpersonation() {
  const { data } = await api.post('/admin/impersonation/end/', {})
  return data
}
