/**
 * The Axios instance: token attachment, CSRF, refresh-and-replay, and the
 * error envelope.
 *
 * These are the tests where a bug is a security bug rather than a
 * cosmetic one, and there are four properties that matter:
 *
 * 1. **The access token never touches persistent storage.** It lives in a
 *    module variable. If a change ever writes it to `localStorage`, an XSS
 *    turns a 30-minute credential into a permanent one — so that is
 *    asserted directly, by sweeping storage after a full refresh cycle.
 *
 * 2. **The refresh endpoint is never asked to refresh itself.** A 401 from
 *    `/auth/refresh/` recursing into the refresh path is an infinite loop
 *    against the endpoint that is already failing.
 *
 * 3. **Concurrent 401s produce exactly one refresh.** `ROTATE_REFRESH_TOKENS`
 *    and `BLACKLIST_AFTER_ROTATION` are on, so a second refresh presents a
 *    token the first already blacklisted and signs the user out. This is
 *    the property the in-flight promise exists for, and it is invisible
 *    without a test that fires several requests at once.
 *
 * 4. **A failed refresh ends the session and reports it once.** The client
 *    cannot clear React state, so it calls back into the app. A session
 *    that ends without that callback leaves a signed-in UI over a dead
 *    token.
 *
 * Axios is mocked at the adapter level rather than by stubbing the module.
 * Stubbing `axios.create` would mean testing a fake, and the interceptor
 * chain — which is the entire subject here — would never run.
 *
 * **One thing the adapter cannot see.** The refresh call in `client.js`
 * uses the bare `axios` with an absolute path, while every `api` request
 * keeps its URL relative to `baseURL`. So the adapter records
 * `/me/` for an `api` call and `/api/auth/refresh/` for a refresh. The
 * matchers below use `REFRESH_URL` accordingly; matching on the short
 * form would silently never fire and every refresh test would fail with a
 * misleading "no route planned for this request".
 */

import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The lease coordinates across tabs and would otherwise make every refresh
// wait out its grace period (60ms of jitter plus a 60ms grace per round).
// It has its own contract; here it must simply pass through, so these tests
// measure the interceptor and not the lease.
vi.mock('./tabBus', async () => {
  const actual = await vi.importActual('./tabBus')
  return {
    ...actual,
    withRefreshLease: async (refresh) => ({ rotated: true, value: await refresh() }),
  }
})

/**
 * The URL the adapter sees for a refresh.
 *
 * Not `/auth/refresh/`: `refreshAccessToken` calls the bare `axios` with
 * the fully-qualified path, because it must not go through the `api`
 * instance's own interceptors. See the module docstring.
 */
const REFRESH_URL = '/api/auth/refresh/'

/** The adapter Axios ships with, restored after each test. */
const ORIGINAL_ADAPTER = axios.defaults.adapter

/** Every request the adapter was asked to make, in order. */
let calls = []

/**
 * A scripted adapter: a list of `[matchFn, handler]` handlers, first match
 * wins. Anything unmatched throws, so a test that forgets a route fails
 * loudly instead of silently getting `undefined`.
 */
let routes = []

function route(match, handler) {
  routes.push([match, handler])
}

function removeRoute(match) {
  const index = routes.findIndex((r) => r[0] === match)
  if (index !== -1) routes.splice(index, 1)
}

/** Queue a JSON response for every request matching `match`. */
function respond(match, { status = 200, data = {} } = {}) {
  route(match, (config) => ({ status, data, headers: {}, config }))
}

/** Queue an Axios-shaped rejection, which is what a 4xx looks like. */
function axiosFailure(config, status, data) {
  const error = new Error(`Request failed with status code ${status}`)
  error.config = config
  error.response = { status, data, headers: {}, config }
  error.isAxiosError = true
  return error
}

/** Queue a rejection for every request matching `match`. */
function fail(match, { status = 401, data = {} } = {}) {
  route(match, (config) => {
    throw axiosFailure(config, status, data)
  })
}

/**
 * Queue a rejection for the *next* request matching `match` only.
 *
 * The distinction from `fail` is what makes the refresh tests work.
 * Handlers are first-match-wins, so a permanent 401 handler for `/me/`
 * would also swallow the *replay* of `/me/` and the replay would 401 again
 * instead of reaching the route planned for it. A once-only handler steps
 * aside after firing and lets the replay through.
 */
function failOnce(match, { status = 401, data = {} } = {}) {
  route(match, (config) => {
    removeRoute(match)
    throw axiosFailure(config, status, data)
  })
}

/**
 * A ceiling on how many requests a single test may make.
 *
 * Several of these tests exercise a retry path, and the bug they guard
 * against is a retry that never stops. An unbounded loop does not fail
 * politely: the replay resolves from an already-settled promise, so the
 * loop never yields to the event loop and Vitest's own 5s timeout — which
 * is a timer — never gets to fire. The run hangs until something outside
 * kills it, which in CI means the whole job's budget.
 *
 * So the adapter refuses to serve past this point and throws something
 * that names the problem. A runaway loop then fails in milliseconds with a
 * legible message instead of hanging.
 */
const MAX_CALLS = 50

function installAdapter() {
  axios.defaults.adapter = async (config) => {
    calls.push(config)
    if (calls.length > MAX_CALLS) {
      throw new Error(
        `The client made more than ${MAX_CALLS} requests — a retry loop is ` +
          `probably not terminating. Last request: ${config.method} ${config.url}`,
      )
    }
    for (const [match, handler] of routes) {
      if (match(config)) return handler(config)
    }
    throw new Error(
      `No route for ${config.method} ${config.url} — the test did not plan for it.`,
    )
  }
}

// The module under test reads cookies for CSRF, so a cookie has to exist.
function setCookie(name, value) {
  document.cookie = `${name}=${value}`
}

/** Sweep every place a token could have been persisted. */
function persistedTokenLocations() {
  const found = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    found.push([`localStorage.${key}`, localStorage.getItem(key)])
  }
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i)
    found.push([`sessionStorage.${key}`, sessionStorage.getItem(key)])
  }
  return found
}

/** The URLs of the refresh calls the adapter saw. */
function refreshes() {
  return calls.filter((c) => c.url === REFRESH_URL)
}

// Imported fresh in `beforeEach` so each test gets its own interceptor
// chain and its own in-memory token.
let clientModule
let api

beforeEach(async () => {
  calls = []
  routes = []
  installAdapter()
  setCookie('csrftoken', 'csrf-value')
  vi.resetModules()
  clientModule = await import('./client')
  api = clientModule.api
  clientModule.setAccessToken(null)
  clientModule.setSessionExpiredHandler(null)
})

afterEach(() => {
  axios.defaults.adapter = ORIGINAL_ADAPTER
})

// ── Token attachment ─────────────────────────────────────────────────
describe('the request interceptor', () => {
  it('attaches the access token as a bearer header', async () => {
    clientModule.setAccessToken('token-abc')
    respond((c) => c.url === '/me/', { data: { id: 1 } })

    await api.get('/me/')

    expect(calls[0].headers.Authorization).toBe('Bearer token-abc')
  })

  it('sends no Authorization header when there is no token', async () => {
    respond((c) => c.url === '/me/', { data: {} })

    await api.get('/me/')

    expect(calls[0].headers.Authorization).toBeUndefined()
  })

  it('sends the CSRF header on unsafe methods', async () => {
    respond((c) => c.url === '/things/', { status: 201 })

    await api.post('/things/', { name: 'x' })

    expect(calls[0].headers['X-CSRFToken']).toBe('csrf-value')
  })

  it('does not send the CSRF header on a GET', async () => {
    // Harmless but pointless, and it would force a cookie read on every
    // feed request.
    respond((c) => c.url === '/feed/', { data: {} })

    await api.get('/feed/')

    expect(calls[0].headers['X-CSRFToken']).toBeUndefined()
  })

  it('drops a hand-set Content-Type on a FormData body', async () => {
    // A hand-set Content-Type on a FormData body omits the boundary, and
    // the server cannot parse the upload at all. The interceptor deletes
    // the header so the browser can generate one with the boundary in it.
    //
    // What the adapter *then* sees depends on which Axios platform is
    // loaded: in a browser the header is gone, but this test runs under
    // Node's module resolution (Vite does not apply Axios's `browser`
    // package field), where `dispatchRequest` fills the gap with its own
    // `application/x-www-form-urlencoded` default. Asserting the exact
    // value would therefore pin the *environment* rather than the
    // behaviour. Asserting that the value we passed did not survive pins
    // the `delete`, which is the actual subject — and it fails if the
    // `delete` is removed, because then `multipart/form-data` would pass
    // through untouched.
    respond((c) => c.url === '/photos/', { status: 201 })
    const body = new FormData()
    body.append('caption', 'hi')

    await api.post('/photos/', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    expect(calls[0].headers['Content-Type']).not.toBe('multipart/form-data')
    // The body itself is untouched — only the header was cleared.
    expect(calls[0].data).toBe(body)
  })

  it.todo(
    'leaves no Content-Type at all on a FormData body (needs a browser ' +
      'Axios platform; see the comment above)',
  )
})

// ── Refresh and replay ───────────────────────────────────────────────
describe('the 401 refresh path', () => {
  it('refreshes once and replays the original request', async () => {
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', {
      data: { id: 7 },
    })

    const response = await api.get('/me/')

    expect(response.data).toEqual({ id: 7 })
    expect(calls.map((c) => c.url)).toEqual(['/me/', REFRESH_URL, '/me/'])
  })

  it('stores the new token in memory and nowhere else', async () => {
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh-token-value' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh-token-value', {
      data: {},
    })

    await api.get('/me/')

    expect(clientModule.getAccessToken()).toBe('fresh-token-value')
    // The security property: an XSS that reads storage must find nothing.
    const persisted = persistedTokenLocations()
    expect(persisted).toEqual([])
    expect(JSON.stringify(persisted)).not.toContain('fresh-token-value')
  })

  it('replays with the new token attached', async () => {
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', { data: {} })

    await api.get('/me/')

    expect(calls[2].headers.Authorization).toBe('Bearer fresh')
  })

  it('retries a replayed request only once', async () => {
    // If the replay also 401s, retrying again would loop against a server
    // that has already said no twice. The `/me/` failure is permanent on
    // purpose here: the replay must be allowed to fail again so that the
    // absence of a *second* refresh is what is being measured.
    clientModule.setAccessToken('stale')
    fail((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })

    await expect(api.get('/me/')).rejects.toMatchObject({ status: 401 })

    expect(refreshes()).toHaveLength(1)
    expect(calls.filter((c) => c.url === '/me/')).toHaveLength(2)
  })

  it('fires exactly one refresh for concurrent 401s', async () => {
    // The property the in-flight promise exists for. With rotation and
    // blacklisting on, a second refresh presents a token the first has
    // already invalidated — the user is signed out by their own retry.
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url.startsWith('/a'))
    failOnce((c) => c.url.startsWith('/b'))
    failOnce((c) => c.url.startsWith('/c'))
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url.startsWith('/a') && c.headers.Authorization === 'Bearer fresh', {
      data: { ok: 'a' },
    })
    respond((c) => c.url.startsWith('/b') && c.headers.Authorization === 'Bearer fresh', {
      data: { ok: 'b' },
    })
    respond((c) => c.url.startsWith('/c') && c.headers.Authorization === 'Bearer fresh', {
      data: { ok: 'c' },
    })

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])

    expect(results.map((r) => r.data.ok)).toEqual(['a', 'b', 'c'])
    expect(refreshes()).toHaveLength(1)
  })

  it('does not refresh on a 401 from the refresh endpoint itself', async () => {
    // Otherwise the refresh failure recurses into another refresh.
    //
    // The assertion is on `refreshes()` rather than on the request count,
    // and that distinction is the whole test. With the guard removed the
    // recursive refresh *is* attempted and the adapter records it — but it
    // then has no planned route and throws, so the request count still
    // comes out at one and a count-based assertion would pass against the
    // bug. Counting attempts at the refresh URL is what actually pins it.
    fail((c) => c.url === '/auth/refresh/')

    await expect(api.post('/auth/refresh/')).rejects.toMatchObject({ status: 401 })

    expect(refreshes()).toHaveLength(0)
    expect(calls.filter((c) => c.url === '/auth/refresh/')).toHaveLength(1)
  })

  it('does not refresh on a 401 from login', async () => {
    // A wrong password is not a stale token, and retrying turns a clear
    // message into a confusing double request.
    fail((c) => c.url === '/auth/login/')

    await expect(api.post('/auth/login/', {})).rejects.toMatchObject({ status: 401 })

    expect(refreshes()).toHaveLength(0)
    expect(calls.filter((c) => c.url === '/auth/login/')).toHaveLength(1)
  })

  it('does not refresh on a 403', async () => {
    // Forbidden is a permissions answer, not an expiry one.
    clientModule.setAccessToken('valid')
    fail((c) => c.url === '/admin/thing/', { status: 403 })

    await expect(api.get('/admin/thing/')).rejects.toMatchObject({ status: 403 })

    expect(refreshes()).toHaveLength(0)
  })

  it('does not refresh on a 500', async () => {
    clientModule.setAccessToken('valid')
    fail((c) => c.url === '/thing/', { status: 500 })

    await expect(api.get('/thing/')).rejects.toMatchObject({ status: 500 })

    expect(refreshes()).toHaveLength(0)
  })
})

// ── Session expiry ───────────────────────────────────────────────────
describe('when the refresh fails for good', () => {
  it('clears the token and calls the session-expired handler once', async () => {
    clientModule.setAccessToken('stale')
    const onExpired = vi.fn()
    clientModule.setSessionExpiredHandler(onExpired)
    failOnce((c) => c.url === '/me/')
    fail((c) => c.url === REFRESH_URL)

    await expect(api.get('/me/')).rejects.toBeDefined()

    expect(clientModule.getAccessToken()).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('still rejects with a usable error after expiring', async () => {
    // The caller must be able to render something. A rejected `undefined`
    // would surface as an unrelated crash in a component.
    clientModule.setAccessToken('stale')
    clientModule.setSessionExpiredHandler(() => {})
    failOnce((c) => c.url === '/me/')
    fail((c) => c.url === REFRESH_URL)

    await expect(api.get('/me/')).rejects.toMatchObject({ name: 'ApiError' })
  })

  it('does not call the handler for a recoverable 401', async () => {
    clientModule.setAccessToken('stale')
    const onExpired = vi.fn()
    clientModule.setSessionExpiredHandler(onExpired)
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', { data: {} })

    await api.get('/me/')

    expect(onExpired).not.toHaveBeenCalled()
  })

  it('survives there being no handler registered', async () => {
    // The client is used before the provider mounts during boot.
    clientModule.setAccessToken('stale')
    clientModule.setSessionExpiredHandler(null)
    failOnce((c) => c.url === '/me/')
    fail((c) => c.url === REFRESH_URL)

    await expect(api.get('/me/')).rejects.toBeDefined()
    expect(clientModule.getAccessToken()).toBeNull()
  })
})

// ── CSRF and credentials on the refresh call ─────────────────────────
describe('the refresh request itself', () => {
  it('carries the CSRF header', async () => {
    // The refresh endpoint is a POST, and Django rejects it without the
    // header — the failure would look like an expired session.
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', { data: {} })

    await api.get('/me/')

    expect(refreshes()[0].headers['X-CSRFToken']).toBe('csrf-value')
  })

  it('sends credentials so the httpOnly cookie goes with it', async () => {
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', { data: {} })

    await api.get('/me/')

    expect(refreshes()[0].withCredentials).toBe(true)
  })

  it('sends no Authorization header on the refresh call', async () => {
    // The refresh token is the cookie; sending the dead access token adds
    // nothing and leaks it to an endpoint that does not need it.
    clientModule.setAccessToken('stale')
    failOnce((c) => c.url === '/me/')
    respond((c) => c.url === REFRESH_URL, { data: { access: 'fresh' } })
    respond((c) => c.url === '/me/' && c.headers.Authorization === 'Bearer fresh', { data: {} })

    await api.get('/me/')

    expect(refreshes()[0].headers.Authorization).toBeUndefined()
  })
})

// ── Boot ─────────────────────────────────────────────────────────────
describe('restoring a session at boot', () => {
  it('fetches a CSRF token before refreshing', async () => {
    // The refresh cookie is scoped, and a first-time visitor has no CSRF
    // cookie yet, so the POST would be rejected before it ever presented
    // the refresh cookie.
    respond((c) => c.url === '/api/auth/csrf/', { data: { csrfToken: 'boot-csrf' } })
    respond((c) => c.url === REFRESH_URL, { data: { access: 'boot-token' } })

    await clientModule.refreshSession()

    expect(calls.map((c) => c.url)).toEqual(['/api/auth/csrf/', REFRESH_URL])
    expect(clientModule.getAccessToken()).toBe('boot-token')
    expect(persistedTokenLocations()).toEqual([])
  })

  it('propagates a failure rather than inventing a session', async () => {
    // The ordinary case for a first-time visitor. A boot that swallowed
    // this would render a signed-in shell over no token.
    respond((c) => c.url === '/api/auth/csrf/', { data: { csrfToken: 'boot-csrf' } })
    fail((c) => c.url === REFRESH_URL)

    await expect(clientModule.refreshSession()).rejects.toMatchObject({ status: 401 })
    expect(clientModule.getAccessToken()).toBeNull()
  })
})
