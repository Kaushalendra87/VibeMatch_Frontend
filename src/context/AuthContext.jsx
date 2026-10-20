/**
 * Session state.
 *
 * **The boot sequence is the subtle part.** The access token lives in
 * memory only (see `services/client.js`), so a page reload starts with no
 * token at all — but the refresh cookie is still there. `bootstrap()`
 * therefore has to mint a new access token before it can ask who the user
 * is. Rendering the app before that finishes would flash the login screen
 * at a signed-in user, which is why there is an explicit `isBooting` flag
 * and the route guards wait on it.
 *
 * There is no `localStorage` copy of the user either. The cookie is the
 * only durable credential, and a cached user object that outlives a
 * revoked session is a bug waiting to happen.
 *
 * **Cross-tab.** The memory-only token is per-tab by construction, so a
 * sign-out in one tab used to leave every other tab rendering a
 * signed-in UI with a still-valid token. The tab bus (see
 * `services/tabBus.js`) closes that: a `session.ended` message clears the
 * other tabs' state, and a `session.started` adopts a session minted
 * elsewhere. This provider owns both directions because it is the only
 * place that knows what "signed in" means.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import * as authApi from '../services/auth'
import {
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from '../services/client'
import { TAB_EVENT, publish, startTabBus, subscribeToTabBus } from '../services/tabBus'
import { ROLES, STAFF_ROLES } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isBooting, setIsBooting] = useState(true)
  const [error, setError] = useState(null)

  // Guards against a second bootstrap in StrictMode's double-invoke,
  // which would fire two refresh calls and lose the rotation race.
  const booted = useRef(false)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
  }, [])

  /**
   * Try to restore a session from the refresh cookie.
   *
   * A failure here is the *normal* case for a first-time visitor, not an
   * error to surface — so it clears state silently.
   */
  const bootstrap = useCallback(async () => {
    try {
      // Mints an access token from the refresh cookie. Throws for a
      // visitor with no session, which is expected rather than an error.
      await refreshSession()
      const me = await authApi.fetchMe()
      setUser(me)
    } catch {
      clearSession()
    } finally {
      setIsBooting(false)
    }
  }, [clearSession])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    bootstrap()
  }, [bootstrap])

  // A refresh that fails for good means the session is over. The client
  // cannot clear React state itself, so it calls back here.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession()
      // Tell the other tabs. A blacklisted refresh token is not per-tab:
      // every tab sharing this cookie is now signed out, and the ones
      // that do not hear about it keep rendering a signed-in shell until
      // their own next request 401s.
      publish(TAB_EVENT.SESSION_EXPIRED)
    })
    return () => setSessionExpiredHandler(null)
  }, [clearSession])

  // ── Cross-tab session sync ─────────────────────────────────────────
  useEffect(() => {
    startTabBus()

    const unsubscribe = subscribeToTabBus((message) => {
      switch (message.type) {
        case TAB_EVENT.SESSION_ENDED:
        case TAB_EVENT.SESSION_EXPIRED:
          // Drop the token and the user. Not `logout()` — that would call
          // the API again, and the session is already gone; a second
          // blacklist attempt is a guaranteed failure and a wasted round
          // trip. The other tab did the work.
          clearSession()
          break
        case TAB_EVENT.SESSION_STARTED:
          // Another tab signed in. Adopt that identity, so a shared
          // machine that had a different account open does not keep
          // rendering the previous one.
          //
          // Only `login` publishes this, so it always carries a user. The
          // guard is defensive: this branch used to share its type with
          // the refresh-lease signal, and reading a missing payload as
          // "anonymous" would have signed every other tab out the moment
          // one of them refreshed. That signal is now its own event
          // (`SESSION_ROTATED`), which this switch ignores.
          if (message.payload?.user) {
            setUser(message.payload.user)
          }
          break
        case TAB_EVENT.USER_UPDATED:
          // Same person, changed card. Merge rather than replace, so a
          // field the patch does not mention is not blanked out.
          setUser((current) =>
            current ? { ...current, ...(message.payload?.patch ?? {}) } : current,
          )
          break
        default:
          break
      }
    })

    return unsubscribe
  }, [clearSession])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const data = await authApi.login(email, password)
      setUser(data.user)
      publish(TAB_EVENT.SESSION_STARTED, { user: data.user })
      return data
    } catch (err) {
      setError(err)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    // Publish before the request, not after. The API call blacklists the
    // refresh cookie; if it is slow or fails, the other tabs are already
    // in the right state, and a failure to reach the server is not a
    // reason to leave a signed-in UI on screen anywhere.
    clearSession()
    publish(TAB_EVENT.SESSION_ENDED)
    try {
      await authApi.logout()
    } catch {
      // The local session is already gone, which is what the user asked
      // for. The cookie is blacklisted server-side on the next attempt,
      // or expires on its own.
    }
  }, [clearSession])

  /** Re-read the current user — used after a profile edit changes the card. */
  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.fetchMe()
      setUser(me)
      return me
    } catch {
      // A failure here usually means the session ended between the edit
      // and this call. Leave the existing user in place rather than
      // logging out on a transient error.
      return null
    }
  }, [])

  /**
   * Replace the cached user with a patch, and tell the other tabs.
   *
   * Used when something this tab did changed the user's own card — a new
   * avatar, a renamed profile. Without the broadcast the other tabs keep
   * the old avatar in their navbar until they reload, which is the same
   * staleness the server-side `profile.updated` frame fixes for *other*
   * people's cards.
   *
   * The identity is unchanged, so this is `USER_UPDATED` and not
   * `SESSION_STARTED`: a listener that adopts a session would otherwise
   * treat a photo upload as a fresh sign-in.
   *
   * **The patch is computed outside the state updater on purpose.** The
   * obvious shape — `setUser((current) => {...; publish(...); ...})` —
   * puts a side effect in a function React is explicitly allowed to call
   * more than once (StrictMode double-invokes updaters), which would
   * broadcast every patch twice. The ref is the same "latest value"
   * mirror as `booted` above: updated eagerly here so two patches in one
   * tick compose, and re-synced by the effect below whenever `user`
   * changes from any other source (bootstrap, login, another tab).
   */
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const patchUser = useCallback((patch) => {
    if (!userRef.current) return
    const next = { ...userRef.current, ...patch }
    userRef.current = next
    setUser(next)
    publish(TAB_EVENT.USER_UPDATED, { patch })
  }, [])

  const value = useMemo(
    () => ({
      user,
      isBooting,
      error,
      isAuthenticated: Boolean(user),
      // `is_staff_role` is the server's own answer and covers a moderator
      // whose role was changed mid-session; the local role check is a
      // fallback for an older payload.
      isStaff: Boolean(user?.is_staff_role) || STAFF_ROLES.includes(user?.role),
      isAdmin: user?.role === ROLES.ADMIN,
      login,
      logout,
      refreshUser,
      patchUser,
      clearSession,
      /** True once the address is confirmed — login is blocked until then. */
      isEmailVerified: Boolean(user?.email_verified),
      /** 0-100, from the profile's own completeness score. */
      profileCompletion: user?.profile_completion ?? 0,
      hasCompletedOnboarding: Boolean(user?.onboarding_completed),
      hasActiveSubscription: Boolean(user?.has_active_subscription),
      planName: user?.plan_name ?? null,
    }),
    [user, isBooting, error, login, logout, refreshUser, patchUser, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
