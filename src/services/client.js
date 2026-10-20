/**
 * The single Axios instance every API call goes through.
 *
 * Three jobs, all of which have to live in one place because they are
 * ordering-sensitive:
 *
 * 1. **Attach the access token.** Held in a module variable, not
 *    localStorage. It is short-lived (30 min) and the refresh token that
 *    actually matters is httpOnly, so persisting this one would add an
 *    XSS-exfiltratable credential for no benefit. A reload re-mints it
 *    from the cookie, which is a single request during boot.
 *
 * 2. **Refresh once, then replay.** A 401 triggers a refresh, and every
 *    other request that was in flight when the refresh started waits on
 *    the same promise. Without that, ten parallel calls each fire their
 *    own refresh and nine of them lose the rotation race.
 *
 * 3. **Normalise errors.** The backend wraps every failure in
 *    `{error: {code, message, details, request_id}}`. This unwraps it to a
 *    plain `ApiError` so no component has to know that shape.
 */

import axios from 'axios'

import { withRefreshLease } from './tabBus'

/** Matches `settings.REFRESH_COOKIE_NAME` and the cookie the SPA reads. */
const CSRF_COOKIE = 'csrftoken'
const CSRF_HEADER = 'X-CSRFToken'

export const API_BASE_URL = 'https://vibematch-api-c6w0.onrender.com/api'

/**
 * Endpoints that must never trigger the refresh-and-replay path.
 *
 * `refresh/` would recurse. `login/` and `register/` return a 401/403 for
 * reasons that a refresh cannot fix, and retrying them would turn a clear
 * "wrong password" into a confusing double request.
 */
const NO_REFRESH_PATHS = [
  '/auth/refresh/',
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-email/',
]

// ── Token storage ────────────────────────────────────────────────────
let accessToken = null
let onSessionExpired = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

/**
 * Register the callback that runs when a refresh fails for good.
 *
 * The client cannot navigate or clear React state itself, so it calls
 * back into the app, which unmounts the session. Set once at boot.
 */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

// ── CSRF ─────────────────────────────────────────────────────────────
function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Fetch a CSRF token and let Django set the cookie.
 *
 * Called during boot and again before a login, because the cookie is
 * scoped and a user who has never visited has no token yet.
 */
export async function bootstrapCsrf() {
  const { data } = await axios.get(`${API_BASE_URL}/auth/csrf/`, {
    withCredentials: true,
  })
  return data?.csrfToken || readCookie(CSRF_COOKIE)
}

// ── The instance ─────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: API_BASE_URL,
  // Required for the refresh cookie to be sent and stored. Safe because
  // the dev server proxies /api, so this is same-origin in practice.
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  // Only unsafe methods need CSRF. Sending it on GETs is harmless but
  // pointless, and it would force a cookie read on every feed request.
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = readCookie(CSRF_COOKIE)
    if (token) config.headers[CSRF_HEADER] = token
  }

  // Let the browser set the multipart boundary itself.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})

// ── Refresh coordination ─────────────────────────────────────────────
/**
 * The in-flight refresh, shared by every caller that needs one.
 *
 * `null` means no refresh is running. Any 401 that arrives while this is
 * set awaits it rather than starting a second one.
 */
let refreshPromise = null

function shouldAttemptRefresh(config) {
  const url = config?.url || ''
  if (NO_REFRESH_PATHS.some((path) => url.includes(path))) return false
  // A 401 from the refresh endpoint itself is handled by the refresh
  // routine, not by this interceptor.
  return !config?._retried
}

async function refreshAccessToken() {
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/refresh/`,
    {},
    {
      withCredentials: true,
      headers: { [CSRF_HEADER]: readCookie(CSRF_COOKIE) || '' },
    },
  )
  setAccessToken(data.access)
  return data.access
}

/**
 * Refresh, coordinating with the other tabs first.
 *
 * `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` are both on, so
 * two tabs refreshing at the same instant is not merely a wasted request:
 * the loser presents a token the winner has already blacklisted, gets a
 * 401, and signs itself out. `refreshPromise` above serialises refreshes
 * *within* a tab and cannot see the others; the lease in
 * `services/tabBus.js` extends that across them.
 *
 * This function is now a thin wrapper, and deliberately so. All of the
 * ordering lives in `withRefreshLease`, which either returns a token this
 * tab minted or throws — there is no "another tab did it" branch to
 * handle, because a tab that deferred takes its own turn rather than
 * reusing a token it never sees. Keeping that logic in one place is what
 * makes it testable; see the lease's docstring for the chain it enforces.
 *
 * The catch is the deadlock escape hatch the lease's contract promises.
 * Exhausting the attempts means the lease could not agree — every round
 * was contested, or a holder was closed mid-refresh — not that the
 * refresh token is invalid. Refreshing directly is the right last resort:
 * if the token really is gone this throws and the caller signs out, and if
 * it was fine the session survives an election that failed to resolve.
 * Signing out on a lease failure would be the wrong failure to hand a
 * user, because the common cause is a scheduling race, not an expired
 * session.
 */
async function refreshAccessTokenLeased() {
  try {
    const { value } = await withRefreshLease(refreshAccessToken)
    return value
  } catch {
    return refreshAccessToken()
  }
}

/**
 * Restore a session from the refresh cookie, for the boot sequence.
 *
 * Exported because the app needs this before it has a user, so it cannot
 * go through the interceptor's 401 path — there is nothing to retry.
 * Returns the new access token, or throws if there is no valid session,
 * which is the ordinary case for a first-time visitor.
 *
 * The failure is normalised to an `ApiError` like every other failure the
 * module produces. Both of these calls use the bare `axios`, so without
 * this they would reject with a raw `AxiosError` — a second, undocumented
 * error shape escaping the one module whose stated job is to unwrap the
 * backend envelope. Today's caller in `AuthContext` discards the error, so
 * nothing is broken; the point is that the next caller should not have to
 * know which of two shapes it is catching.
 */
export async function refreshSession() {
  try {
    await bootstrapCsrf()
    return await refreshAccessToken()
  } catch (error) {
    throw toApiError(error)
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    const status = response?.status

    if (status === 401 && config && shouldAttemptRefresh(config)) {
      config._retried = true

      try {
        // Join the in-flight refresh if there is one; otherwise start it.
        // Assigning to the shared variable synchronously — before any
        // await — is what makes this race-free.
        if (!refreshPromise) {
          refreshPromise = refreshAccessTokenLeased().finally(() => {
            refreshPromise = null
          })
        }
        await refreshPromise

        // Replay with the new token. The request interceptor re-attaches
        // it, so nothing else needs to change here.
        return api(config)
      } catch {
        // The refresh token is gone or blacklisted. There is no recovery
        // short of signing in again.
        setAccessToken(null)
        if (onSessionExpired) onSessionExpired()
        return Promise.reject(toApiError(error))
      }
    }

    return Promise.reject(toApiError(error))
  },
)

// ── Error normalisation ──────────────────────────────────────────────
/**
 * A failure the UI can render without inspecting Axios internals.
 *
 * `fieldErrors` is populated from the envelope's `details` when it looks
 * like a DRF field-error map, which is what a form needs to mark the
 * offending input. `isNetworkError` distinguishes "the server said no"
 * from "the server was not reached" — the two need different messages,
 * and conflating them makes an outage look like a validation failure.
 */
export class ApiError extends Error {
  constructor({ message, code, status, details, requestId, isNetworkError = false }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.requestId = requestId
    this.isNetworkError = isNetworkError
    this.fieldErrors = extractFieldErrors(details)
  }

  /** True when the failure is a per-field validation problem. */
  get hasFieldErrors() {
    return Object.keys(this.fieldErrors).length > 0
  }
}

/**
 * Pull `{field: [messages]}` out of the envelope's `details`.
 *
 * DRF nests errors arbitrarily (a list of dicts for bulk endpoints, a
 * dict of lists for a serializer). Only the flat one-field-to-messages
 * case is treated as a field error; anything else is left alone rather
 * than guessed at, because attaching a message to the wrong input is
 * worse than showing it at the top of the form.
 */
function extractFieldErrors(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  const out = {}
  for (const [key, value] of Object.entries(details)) {
    if (key === 'non_field_errors' || key === 'detail') continue
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      out[key] = value
    } else if (typeof value === 'string') {
      out[key] = [value]
    }
  }
  return out
}

export function toApiError(error) {
  if (error instanceof ApiError) return error

  // No response at all: DNS failure, offline, CORS block, or a timeout.
  if (!error.response) {
    return new ApiError({
      message:
        error.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : 'Could not reach the server. Check your connection and try again.',
      code: 'network_error',
      status: 0,
      isNetworkError: true,
    })
  }

  const { status, data } = error.response
  const envelope = data?.error

  // The backend's envelope. Anything else is an intermediary (a proxy
  // error page, a 502 HTML body) and gets a status-based fallback.
  if (envelope && typeof envelope === 'object') {
    return new ApiError({
      message: envelope.message || 'Something went wrong.',
      code: envelope.code || 'api_error',
      status,
      details: envelope.details,
      requestId: envelope.request_id,
    })
  }

  return new ApiError({
    message: defaultMessageForStatus(status),
    code: `http_${status}`,
    status,
    details: typeof data === 'object' ? data : null,
  })
}

function defaultMessageForStatus(status) {
  switch (status) {
    case 400:
      return 'That request could not be processed.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'That item could not be found.'
    case 409:
      return 'That action conflicts with existing data.'
    case 429:
      return 'Too many requests. Please slow down and try again shortly.'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Something went wrong on our end. Please try again.'
    default:
      return 'Something went wrong.'
  }
}

/** The `page` number encoded in a DRF `next`/`previous` link, if any. */
function pageFromLink(link) {
  if (!link) return null
  const match = /[?&]page=(\d+)/.exec(link)
  return match ? Number(match[1]) : null
}

/**
 * Unwrap a DRF page-number paginated response.
 *
 * **The server does not send `page` or `total_pages`.**
 * `StandardResultsSetPagination` — which every list endpoint here uses —
 * returns only `{count, next, previous, results}`. `CursorLikePagination`
 * does add `page`/`total_pages`/`next_cursor`, but no view is wired to it,
 * so those keys are always absent in practice. Reading them with a `?? 1`
 * fallback is what silently pinned every list to page one.
 *
 * Both are derived instead, from data the server *does* send. The
 * `next`/`previous` links are absolute URLs, and `previous` encodes the
 * page before this one:
 *
 * - `previous` is null -> nothing precedes this page, so we are on 1.
 * - `previous` present -> this page is `previous`'s page + 1.
 *
 * That second rule has a trap. DRF builds these links by *removing*
 * whatever differs from the defaults, so page 2's `previous` is
 * `?page_size=1` with **no `page=` at all** — page 1 is the default and
 * is therefore omitted. A missing param there means page 1, not "unknown".
 * Treating the two as the same thing reports page 2 as page 1.
 *
 * `totalPages` then follows, and both cases are exact rather than
 * approximate:
 *
 * - Last page (`next` null): the total *is* the current page. No
 *   arithmetic and no page size — which matters, because a partial final
 *   page's `results.length` is *not* the page size and dividing by it
 *   would overstate the total.
 * - Not the last page: the page is full, so `results.length` **is** the
 *   server's page size. That beats echoing back a requested `page_size`,
 *   because the server clamps to `max_page_size` — dividing by the
 *   requested value would understate the total.
 *
 * If the server ever does start sending the real keys, they win.
 */
export function unwrapPage(response) {
  const data = response?.data ?? response
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    const count = data.count ?? data.results.length
    const next = data.next ?? null
    const previous = data.previous ?? null

    let page = data.page
    if (page == null) {
      if (!previous) {
        page = 1
      } else {
        // `page` may be absent because it is the default, not because it
        // is unknown — an omitted param on a real link means page 1.
        page = (pageFromLink(previous) ?? 1) + 1
      }
    }

    let totalPages = data.total_pages
    if (totalPages == null) {
      if (!next) {
        // Last page — the total is where we already are.
        totalPages = page
      } else {
        const pageSize = data.results.length || count || 1
        totalPages = Math.max(page, Math.ceil(count / pageSize))
      }
    }

    return {
      results: data.results,
      count,
      next,
      previous,
      page,
      totalPages,
      nextCursor: data.next_cursor ?? null,
    }
  }
  // A non-paginated list endpoint, or a single object.
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      next: null,
      previous: null,
      page: 1,
      totalPages: 1,
      nextCursor: null,
    }
  }
  return {
    results: [],
    count: 0,
    next: null,
    previous: null,
    page: 1,
    totalPages: 1,
    nextCursor: null,
  }
}
