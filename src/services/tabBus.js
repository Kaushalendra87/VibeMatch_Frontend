/**
 * Cross-tab messaging, and the single-tab lease on the refresh token.
 *
 * **Why this exists.** Everything else in the realtime stack syncs a tab
 * against *the server*. This syncs tabs against *each other*, which is a
 * different problem with a different failure mode. The one that actually
 * bites is sign-out: the access token lives in memory (see
 * `services/client.js`), so it is per-tab by construction. Signing out in
 * tab A cleared tab A's token and blacklisted the refresh cookie, but tab
 * B kept its in-memory access token and carried on rendering a signed-in
 * UI for up to the token's remaining lifetime. On a shared machine that
 * is a live session the user believes they ended.
 *
 * **Two channels, deliberately.** `BroadcastChannel` is the right tool and
 * is used when it exists. It does not exist in older Safari or in some
 * embedded webviews, and a sync layer that silently does nothing there is
 * worse than one that degrades — so a `storage` event listener runs
 * alongside it as a fallback. Both are used rather than either/or because
 * they cost almost nothing: a duplicate delivery is deduplicated by id,
 * and the storage listener is a no-op when BroadcastChannel is present.
 *
 * **Why not just `localStorage` for the token.** That is the usual fix for
 * "tabs disagree", and it is the wrong one here. The access token is
 * deliberately kept out of persistent storage so an XSS cannot exfiltrate
 * a long-lived credential. Sharing it between tabs would undo that to
 * solve a problem that a notification solves just as well: tabs do not
 * need the same token, they need to know when theirs is void.
 *
 * **The refresh lease.** With `ROTATE_REFRESH_TOKENS` and
 * `BLACKLIST_AFTER_ROTATION` both on, two tabs refreshing at the same
 * instant is not merely wasteful — the loser's rotation is rejected
 * because the winner already blacklisted the token it presented, and that
 * tab signs itself out. `services/client.js` already serialises refreshes
 * *within* a tab; the lease extends that across tabs, which is what the
 * in-tab promise could never do.
 */

/** The channel name. Namespaced so it cannot collide with anything else. */
const CHANNEL_NAME = 'vibematch.tab'

/** The localStorage key used for the fallback path. */
const STORAGE_KEY = 'vibematch.tab.message'

/** Messages older than this are ignored, so a stale key left in storage
 *  from a previous session cannot replay an old logout on boot. */
const MESSAGE_TTL_MS = 10_000

/**
 * The message kinds. Every one is a *fact that already happened*, never a
 * request — a tab that receives one reacts, it does not reply. That keeps
 * the bus acyclic, which is what stops two tabs bouncing a message.
 */
export const TAB_EVENT = {
  /** A tab signed in. Carries `{user}`, and others adopt it. */
  SESSION_STARTED: 'session.started',
  /**
   * A tab rotated the refresh cookie. **No payload, by design.**
   *
   * This is a *permission slip*, not a session: it says the shared cookie
   * is now fresh, so another tab may safely read it. It deliberately
   * carries no user and no token — the token never leaves the tab that
   * minted it (see the module docstring), and a listener that adopted a
   * session from it would sign itself out on a payload it never receives.
   */
  SESSION_ROTATED: 'session.rotated',
  /** A tab signed out. Others must drop their token and their caches. */
  SESSION_ENDED: 'session.ended',
  /** A tab noticed the session is gone for good (a failed refresh). */
  SESSION_EXPIRED: 'session.expired',
  /**
   * The signed-in user's own card changed — a new avatar, a renamed
   * profile. Distinct from `SESSION_STARTED` because the identity did not
   * change: conflating them would make a photo upload look like a sign-in
   * to any listener that reacts to one.
   */
  USER_UPDATED: 'user.updated',
  /** A tab changed the theme; others repaint without a reload. */
  THEME_CHANGED: 'theme.changed',
  /** A tab changed data another tab may have cached. */
  DATA_INVALIDATED: 'data.invalidated',
  /** A refresh is in flight in the sending tab. See the lease below. */
  REFRESH_STARTED: 'refresh.started',
}

const listeners = new Set()
const seenIds = new Set()

let channel = null
let started = false
/** Set while this tab is the one holding the refresh lease. */
let leaseId = null

function hasBroadcastChannel() {
  return typeof window !== 'undefined' && 'BroadcastChannel' in window
}

/** A message id, used to drop the duplicate that the two transports make. */
function newId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Start listening. Idempotent — a second call is a no-op.
 *
 * Called from the providers rather than at import time so a test that
 * imports this module does not open a channel as a side effect.
 */
export function startTabBus() {
  if (started || typeof window === 'undefined') return
  started = true

  if (hasBroadcastChannel()) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => deliver(event.data)
  }

  // The fallback, and a harmless companion when BroadcastChannel exists:
  // the two produce the same message and `deliver` dedupes by id. Only
  // fires for *other* tabs — the writing tab does not receive its own
  // storage event, which is exactly the semantics wanted.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      deliver(JSON.parse(event.newValue))
    } catch {
      // Another app on the same origin writing this key, or a truncated
      // write. Not ours to act on.
    }
  })
}

/** Tear down, for tests and for a full unmount. */
export function stopTabBus() {
  if (!started) return
  started = false
  channel?.close()
  channel = null
  leaseId = null
  seenIds.clear()
}

/**
 * Publish a message to the other tabs.
 *
 * Never throws. A tab bus is a convenience: if the browser refuses to
 * open a channel, or storage is full, the app must carry on working in
 * one tab rather than failing the action that triggered the broadcast.
 */
export function publish(type, payload = {}) {
  if (typeof window === 'undefined') return

  const message = { id: newId(), type, payload, at: Date.now() }

  // Mark our own message as seen. `storage` does not echo to the writing
  // tab, but a BroadcastChannel implementation could, and a tab that
  // reacted to its own broadcast would loop.
  seenIds.add(message.id)

  try {
    channel?.postMessage(message)
  } catch {
    // A closed channel, or a payload that cannot be structured-cloned.
    // The storage path below is the backstop.
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
  } catch {
    // Private browsing, or a full quota. Nothing to do — the other tabs
    // simply miss this one message.
  }
}

/** Subscribe to messages. Returns an unsubscribe function. */
export function subscribeToTabBus(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

function deliver(message) {
  if (!message || typeof message !== 'object') return
  if (!message.id || !message.type) return
  if (seenIds.has(message.id)) return
  // A stale key replayed from storage on a later boot.
  if (typeof message.at === 'number' && Date.now() - message.at > MESSAGE_TTL_MS) return

  seenIds.add(message.id)
  // Bounded: the set only ever needs to cover the TTL window, and an
  // unbounded one would grow for the life of the tab.
  if (seenIds.size > 200) {
    seenIds.clear()
    seenIds.add(message.id)
  }

  for (const handler of listeners) {
    try {
      handler(message)
    } catch (err) {
      // One bad subscriber must not stop the others, and must not throw
      // back into the channel's own event dispatch.
      console.error('Tab bus listener failed for', message.type, err)
    }
  }
}

// ── The refresh lease ────────────────────────────────────────────────
/**
 * Claim the right to refresh, or defer to the tab that has it.
 *
 * **Why a lease and not a lock.** There is no atomic compare-and-swap
 * across tabs. What there is: a tab announces `refresh.started` and waits
 * briefly to see whether anyone objects.
 *
 * **What a tab that stands down actually needs.** Not the winner's token —
 * that lives in the winner's memory and is deliberately never shared (see
 * the module docstring). It needs to know *when* the rotation has landed,
 * because the refresh cookie is httpOnly and **same-origin, so it is
 * shared by every tab**: once the winner has rotated it, a refresh issued
 * from here presents the new token and succeeds. A refresh issued *before*
 * that presents the old one and is rejected, because the winner has
 * already blacklisted it. So the wait is the whole point, and a tab that
 * gives up waiting and refreshes anyway signs itself out.
 *
 * **Why a waiter must take its own turn rather than just refreshing.**
 * This is the part that is easy to get wrong, and the two-tab case hides
 * it. The rotation announcement is a broadcast, so *every* waiting tab
 * hears it at the same instant — and if each simply refreshed on hearing
 * it, all but one would present the same newly-rotated cookie and all but
 * one would be rejected and sign themselves out. So a waiter treats the
 * announcement as "the cookie is fresh, take a turn", not "refresh now":
 * it loops, and the next round's lease elects exactly one of the waiters.
 * The result is a chain — rotate, elect, rotate, elect — which is the only
 * ordering that is safe when the token is single-use.
 *
 * **Why the retry loop is bounded.** If nobody is coming — every tab stood
 * down and none won, or the winner was closed mid-refresh — each round is
 * jittered so one tab goes first, and each attempt is capped so this
 * cannot spin. A tab that exhausts its attempts throws, and the caller
 * falls back to refreshing for itself: the lease may delay a refresh, it
 * must never deadlock one.
 *
 * @param {() => Promise<any>} refresh  what to run if the lease is ours
 * @returns {Promise<{rotated: boolean, value?: any}>} `rotated` is false
 *   when another tab did the work — the caller should then refresh
 *   against the cookie that tab rotated, not reuse `value`.
 */
export async function withRefreshLease(refresh, { attempts = 4 } = {}) {
  if (typeof window === 'undefined') return { rotated: true, value: await refresh() }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Jitter before announcing, so simultaneous 401s spread out and one
    // tab wins the first round rather than all of them standing down.
    if (attempt > 0) await sleep(60 + Math.random() * 140)

    const mine = newId()
    let contested = false

    const unsubscribe = subscribeToTabBus((message) => {
      if (message.type === TAB_EVENT.REFRESH_STARTED && message.payload?.lease !== mine) {
        contested = true
      }
    })

    leaseId = mine
    publish(TAB_EVENT.REFRESH_STARTED, { lease: mine })

    // One macrotask of grace, so a simultaneous announcement is heard
    // before either side commits. Deliberately short: this sits in front
    // of every 401, and a user waiting on a retry notices 100ms.
    await sleep(60)

    if (!contested) {
      try {
        const value = await refresh()
        // Tell the waiters the cookie is fresh. Published from inside the
        // lease, before it is released, so the announcement is ordered
        // against the rotation it describes.
        publish(TAB_EVENT.SESSION_ROTATED)
        return { rotated: true, value }
      } finally {
        unsubscribe()
        leaseId = null
      }
    }

    unsubscribe()
    leaseId = null

    // Another tab is rotating. Wait for it to report, then loop — the next
    // round's lease is what elects the one waiter that may go next.
    await waitForRotation()
  }

  throw new Error('No tab completed the refresh in time.')
}

/** True while this tab is the one refreshing. */
export function holdsRefreshLease() {
  return leaseId !== null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Resolve when a tab reports a rotation, or `false` after a timeout.
 *
 * Returning rather than rejecting is what lets the caller loop: a timeout
 * means "try to claim the lease again", not "give up on refreshing". The
 * timeout is what keeps this from being a hang — if the tab that held the
 * lease was closed mid-refresh, nobody is coming.
 */
function waitForRotation(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe()
      resolve(false)
    }, timeoutMs)

    const unsubscribe = subscribeToTabBus((message) => {
      if (message.type === TAB_EVENT.SESSION_ROTATED) {
        clearTimeout(timer)
        unsubscribe()
        resolve(true)
      }
    })
  })
}
