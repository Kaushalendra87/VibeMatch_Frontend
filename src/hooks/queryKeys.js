/**
 * Every React Query key in one place.
 *
 * Centralised because invalidation is only correct if the key used to
 * *invalidate* is structurally a prefix of the key used to *fetch*. A
 * hand-typed array in two files drifts, and the symptom is a stale badge
 * that nobody can reproduce — so the shapes live here and are always
 * called, never inlined.
 *
 * Convention: the first element is the resource, the rest are the
 * parameters that change the response. Anything a mutation needs to
 * invalidate goes at the front so a bare prefix invalidates every variant.
 */

export const queryKeys = {
  // ── Session ────────────────────────────────────────────────────────
  me: () => ['me'],
  sessions: () => ['sessions'],

  // ── Profiles ───────────────────────────────────────────────────────
  myProfile: () => ['my-profile'],
  myStats: () => ['my-stats'],
  myPreference: () => ['my-preferences'],
  myPhotos: () => ['my-photos'],
  myViewers: (page = 1) => ['my-viewers', page],
  /** Prefix `['saved']` invalidates every page of the saved list. */
  savedProfiles: (page = 1) => ['saved', page],
  interests: (params = {}) => ['interests', params],
  publicProfile: (profileId) => ['public-profile', profileId],

  // ── Matching ───────────────────────────────────────────────────────
  /** Prefix `['feed']` invalidates every filtered variant at once. */
  feed: (filters = {}) => ['feed', filters],
  likes: (tab = 'received', page = 1) => ['likes', tab, page],
  likeQuota: () => ['like-quota'],
  matches: (page = 1, status) => ['matches', page, status ?? 'active'],
  match: (matchId) => ['match', matchId],
  matchingConfig: () => ['matching-config'],

  // ── Chat ───────────────────────────────────────────────────────────
  conversations: (params = {}) => ['conversations', params],
  conversation: (conversationId) => ['conversation', conversationId],
  /**
   * Message history is keyed by conversation only — the cursor is passed
   * as the query function's page param, not baked into the key. Baking it
   * in would create a separate cache entry per page and lose the ability
   * to append into one timeline.
   */
  messages: (conversationId) => ['messages', conversationId],
  unreadCount: () => ['unread-count'],

  // ── Notifications ──────────────────────────────────────────────────
  notifications: (params = {}) => ['notifications', params],
  notificationCount: () => ['notification-count'],
  notificationPreferences: () => ['notification-preferences'],

  // ── Moderation ─────────────────────────────────────────────────────
  blockedUsers: () => ['blocked-users'],
  myReports: (page = 1) => ['my-reports', page],

  // ── Admin ──────────────────────────────────────────────────────────
  /**
   * Admin keys are namespaced under `['admin', …]` so a single
   * `invalidateQueries({queryKey: ['admin']})` can refresh the whole
   * dashboard after a bulk change — which is what a role change or a
   * flag flip needs, since both move numbers on several screens.
   */
  adminOverview: () => ['admin', 'overview'],
  adminTimeseries: (days = 30) => ['admin', 'timeseries', days],
  adminCohorts: (weeks = 8) => ['admin', 'cohorts', weeks],

  adminUsers: (filters = {}) => ['admin', 'users', filters],
  adminUser: (userId) => ['admin', 'user', userId],

  adminReports: (filters = {}) => ['admin', 'reports', filters],
  adminReport: (reportId) => ['admin', 'report', reportId],
  adminVerifications: (filters = {}) => ['admin', 'verifications', filters],
  adminPhotos: (filters = {}) => ['admin', 'photos', filters],
  adminModerationLog: (filters = {}) => ['admin', 'moderation-log', filters],

  adminPlans: () => ['admin', 'plans'],
  adminSubscriptions: (filters = {}) => ['admin', 'subscriptions', filters],
  adminPayments: (filters = {}) => ['admin', 'payments', filters],

  adminSettings: () => ['admin', 'settings'],
  adminFlags: () => ['admin', 'flags'],
  adminAuditLog: (filters = {}) => ['admin', 'audit', filters],
  adminImpersonation: (filters = {}) => ['admin', 'impersonation', filters],
}

/** The page-number key React Query uses for cursor-paged lists. */
export const CURSOR_PAGE_PARAM = 'cursor'
