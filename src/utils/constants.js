/**
 * Values mirrored from the backend's `core.constants`.
 *
 * Duplicated rather than fetched because they render as labels and are
 * sent as query-parameter values, and a network round-trip before a
 * `<select>` can render is worse than a list that has to be kept in step.
 * The server stays the source of truth for validation: if these drift, a
 * request is rejected with a readable error rather than the client
 * silently misbehaving.
 */

// ── Accounts ─────────────────────────────────────────────────────────
export const ROLES = { USER: 'user', MODERATOR: 'moderator', ADMIN: 'admin' }

/** Roles that may reach the admin dashboard at all. Mirrors `Role.staff_roles()`. */
export const STAFF_ROLES = [ROLES.MODERATOR, ROLES.ADMIN]

export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  DELETED: 'deleted',
}

// ── Profiles ─────────────────────────────────────────────────────────
/** Identity. */
export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
]

/**
 * Who a user wants to see — separate from identity, and a *different
 * value set*: the preference is plural (`women`) where the identity is
 * singular (`woman`). Mixing them up sends a value the server rejects.
 */
export const GENDER_PREFERENCES = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'non_binary', label: 'Non-binary people' },
  { value: 'everyone', label: 'Everyone' },
]

export const RELATIONSHIP_GOALS = [
  { value: 'long_term', label: 'Long-term partner' },
  { value: 'long_term_open', label: 'Long-term, open to short' },
  { value: 'short_term_open', label: 'Short-term, open to long' },
  { value: 'short_term', label: 'Short-term fun' },
  { value: 'friends', label: 'New friends' },
  { value: 'figuring_out', label: 'Still figuring it out' },
]

/**
 * Read-only. These buckets are *derived* from `last_active_at` by the
 * scorer — a user never picks one, so this is only ever used to render a
 * label, never to populate a form.
 */
export const ACTIVITY_LEVELS = {
  NEW: 'new',
  ACTIVE: 'active',
  CASUAL: 'casual',
  DORMANT: 'dormant',
}

export const ACTIVITY_LABELS = {
  new: 'New here',
  active: 'Active',
  casual: 'Casual',
  dormant: 'Dormant',
}

export const VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const PHOTO_MODERATION = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

// ── Matching ─────────────────────────────────────────────────────────
export const LIKE_KINDS = {
  LIKE: 'like',
  PASS: 'pass',
  SUPER_LIKE: 'super_like',
}

/** The `?tab=` values accepted by `/api/matches/likes/`. */
export const LIKE_TABS = [
  { value: 'received', label: 'Liked you' },
  { value: 'liked', label: 'You liked' },
  { value: 'mutual', label: 'Mutual' },
  { value: 'passed', label: 'Passed' },
]

export const MATCH_STATUS = {
  ACTIVE: 'active',
  UNMATCHED: 'unmatched',
  BLOCKED: 'blocked',
}

/** The `?ordering=` values accepted by the discovery feed. */
export const FEED_ORDERINGS = [
  { value: 'score', label: 'Best match' },
  { value: 'distance', label: 'Nearest' },
  { value: 'activity', label: 'Recently active' },
  { value: 'newest', label: 'Newest' },
]

// ── Chat ─────────────────────────────────────────────────────────────
export const MESSAGE_KINDS = {
  TEXT: 'text',
  IMAGE: 'image',
  GIF: 'gif',
  SYSTEM: 'system',
}

// ── Pagination ───────────────────────────────────────────────────────
/** Mirrors `core.pagination.StandardResultsSetPagination`. */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// ── Client-side limits ───────────────────────────────────────────────
// Every one of these mirrors a server constant. They exist to give the
// user an immediate, local error instead of a round-trip that returns a
// rejection — the server still enforces all of them.
/** Mirrors `profiles.serializers.MAX_PHOTOS`. */
export const MAX_PHOTOS = 9
/**
 * Mirrors the inline limit in `OwnProfileSerializer.validate_prompts`.
 * Not a named constant server-side — if that validator changes, this is
 * the only other place to update.
 */
export const MAX_PROMPTS = 6
/** Mirrors the inline limit in `OwnProfileSerializer.validate_languages`. */
export const MAX_LANGUAGES = 12
/** Mirrors `chat.serializers.MAX_MESSAGE_LENGTH`. */
export const MAX_MESSAGE_LENGTH = 2000
/** Mirrors `settings.MAX_PHOTO_UPLOAD_SIZE_MB`. */
export const MAX_PHOTO_MB = 8
/** Mirrors `settings.MAX_CHAT_IMAGE_SIZE_MB`. */
export const MAX_CHAT_IMAGE_MB = 5
/** Mirrors `chat.events.TYPING_TTL_SECONDS`. */
export const TYPING_TTL_SECONDS = 10
