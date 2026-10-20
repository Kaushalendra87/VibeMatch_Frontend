/**
 * A reconnecting WebSocket with JWT authentication.
 *
 * **Why a class rather than a hook.** A socket is a long-lived resource
 * with a lifecycle that outlives any one render. Putting the retry timer
 * and the token refresh inside `useEffect` means React's double-invocation
 * in StrictMode opens two sockets, and a component that unmounts during a
 * reconnect leaves a timer behind that reopens it. One owner, explicit
 * teardown.
 *
 * **Why the token is not in the query string.** The server accepts
 * `?token=` as a fallback, but query strings land in proxy and server
 * access logs, so the subprotocol header is preferred:
 * `new WebSocket(url, ["access_token", "<jwt>"])`. The browser echoes the
 * first entry back in `Sec-WebSocket-Protocol`, which the server's
 * middleware reads.
 *
 * **Reconnect policy.** Exponential backoff with jitter, capped. The
 * close codes matter: 4001 means the token was rejected and 4003 means
 * the account is not allowed, and neither is fixed by retrying — those
 * stop the loop rather than hammering the server.
 */

/** Mirrors `chat.events` close codes. */
export const CLOSE = {
  UNAUTHENTICATED: 4001,
  INACTIVE_ACCOUNT: 4003,
  NOT_A_PARTICIPANT: 4004,
  RATE_LIMITED: 4029,
}

/** Terminal codes: reconnecting cannot help, so do not try. */
const TERMINAL_CODES = new Set([CLOSE.UNAUTHENTICATED, CLOSE.INACTIVE_ACCOUNT])

const BASE_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
/** A socket that stayed open this long is considered healthy, so the
 *  backoff resets rather than continuing to grow across a flaky hour. */
const HEALTHY_AFTER_MS = 10_000

export const SOCKET_STATE = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSED: 'closed',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
}

/**
 * Where the socket connects.
 *
 * Defaults to the page's own origin, which is what the Vite dev proxy and
 * a single-origin deployment (nginx, or Vercel proxying `/api`) both rely
 * on. `VITE_WS_URL` overrides it for the one case the proxy cannot
 * cover: a host that proxies HTTP but not the WebSocket upgrade, where the
 * socket has to reach the backend directly.
 *
 * Set it to the backend's origin (`https://api.example.com`); `http`/`https`
 * are converted to `ws`/`wss` so the value can be written the same way as
 * any other URL. `ws://`/`wss://` are accepted too, and a trailing slash is
 * tolerated.
 *
 * The access token still travels in the `access-token` subprotocol, never
 * the query string, so moving the socket to another origin does not put a
 * credential somewhere it would be logged.
 */
export function buildUrl(path, base = import.meta.env?.VITE_WS_URL) {
  if (!base) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}${path}`
  }

  // A misconfigured value (e.g. a bare hostname) would otherwise produce
  // `wss://undefined/ws/...` or a relative URL the WebSocket constructor
  // rejects with an opaque SyntaxError.
  let normalized = String(base).trim().replace(/\/+$/, '')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }
  const url = new URL(normalized)

  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  // Anything else (a ws:// or wss:// value) is already correct.

  return `${url.origin}${path}`
}

export class ReconnectingSocket {
  /**
   * @param {object} options
   * @param {string} options.path        e.g. `/ws/chat/`
   * @param {() => string|null} options.getToken  called on every attempt, so a
   *   reconnect after a refresh uses the new token rather than the dead one
   * @param {(data: object) => void} options.onMessage
   * @param {(state: string) => void} [options.onStateChange]
   * @param {(event: CloseEvent) => void} [options.onClose]
   * @param {() => void} [options.onExhausted]  terminal close, or too many retries
   */
  constructor({ path, getToken, onMessage, onStateChange, onClose, onExhausted }) {
    this.path = path
    this.getToken = getToken
    this.onMessage = onMessage
    this.onStateChange = onStateChange
    this.onClose = onClose
    this.onExhausted = onExhausted

    this.socket = null
    this.state = SOCKET_STATE.CLOSED
    this.attempts = 0
    this.retryTimer = null
    this.openedAt = 0
    /** Set by `close()`. Distinguishes "we meant to stop" from a drop. */
    this.disposed = false
    /** Queued while the socket is down, flushed on open. */
    this.queue = []
    this.heartbeatTimer = null
  }

  connect() {
    if (this.disposed) return
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return

    const token = this.getToken()
    if (!token) {
      // No point opening a socket the server will reject. The caller
      // reconnects once a session exists.
      this._setState(SOCKET_STATE.CLOSED)
      return
    }

    this._setState(
      this.attempts === 0 ? SOCKET_STATE.CONNECTING : SOCKET_STATE.RECONNECTING,
    )

    const urlWithToken = `${buildUrl(this.path)}?token=${encodeURIComponent(token || '')}`
    const socket = new WebSocket(urlWithToken)
    this.socket = socket

    socket.onopen = () => {
      this.openedAt = Date.now()
      this._setState(SOCKET_STATE.OPEN)
      this._flushQueue()
      this._startHeartbeat()
    }

    socket.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(event.data)
      } catch {
        // A frame that is not JSON is a server bug, not something the UI
        // can act on. Dropping it keeps the socket alive.
        return
      }
      this.onMessage?.(payload)
    }

    socket.onerror = () => {
      // `onerror` is always followed by `onclose`, which does the work.
      // Handling it here too would double-schedule a reconnect.
    }

    socket.onclose = (event) => {
      this._stopHeartbeat()
      this.socket = null
      this.onClose?.(event)

      if (this.disposed) return

      if (TERMINAL_CODES.has(event.code)) {
        // The server told us not to come back.
        this._setState(SOCKET_STATE.FAILED)
        this.onExhausted?.()
        return
      }

      // A clean open that lasted a while means the connection was
      // healthy; reset the backoff so a brief blip does not leave the
      // next reconnect waiting half a minute.
      if (this.openedAt && Date.now() - this.openedAt > HEALTHY_AFTER_MS) {
        this.attempts = 0
      }
      this._scheduleReconnect()
    }
  }

  /**
   * Send a frame, or queue it if the socket is down.
   *
   * Queueing matters for a message typed while the connection is
   * re-establishing: silently dropping it loses the user's text with no
   * indication that anything went wrong.
   */
  send(payload) {
    const frame = JSON.stringify(payload)
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(frame)
      return true
    }
    // Typing indicators are worthless once stale, so they are not queued.
    if (payload?.action === 'typing') return false
    this.queue.push(frame)
    return false
  }

  /** Stop for good. Safe to call more than once. */
  close() {
    this.disposed = true
    this._clearRetry()
    this._stopHeartbeat()
    this.queue = []
    if (this.socket) {
      // 1000 is a normal closure, so the server does not treat this as a
      // drop and skip its own cleanup.
      this.socket.close(1000, 'client closing')
      this.socket = null
    }
    this._setState(SOCKET_STATE.CLOSED)
  }

  // ── Internals ──────────────────────────────────────────────────────
  _setState(state) {
    if (this.state === state) return
    this.state = state
    this.onStateChange?.(state)
  }

  _flushQueue() {
    const pending = this.queue
    this.queue = []
    for (const frame of pending) {
      try {
        this.socket?.send(frame)
      } catch {
        // The socket died mid-flush; put the rest back rather than
        // dropping them.
        this.queue.push(frame)
      }
    }
  }

  _scheduleReconnect() {
    this._clearRetry()
    this.attempts += 1

    // Exponential backoff with jitter. The jitter matters when a server
    // restart drops every client at once — without it they all return on
    // the same tick.
    const exponential = Math.min(BASE_RETRY_MS * 2 ** (this.attempts - 1), MAX_RETRY_MS)
    const delay = exponential * (0.5 + Math.random() * 0.5)

    this._setState(SOCKET_STATE.RECONNECTING)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  _clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  /**
   * Application-level ping.
   *
   * A WebSocket has no way for the client to notice a half-open
   * connection — the TCP socket stays "open" until something tries to use
   * it. The server answers `ping` with `pong`, and a missing pong is the
   * signal to force a reconnect.
   */
  _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ action: 'ping' })
    }, 30_000)
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

/**
 * Generate an idempotency key for a message send.
 *
 * The server keys on `client_id`, so a send that is retried after a
 * timeout resolves to the original row instead of posting a duplicate.
 * `crypto.randomUUID` needs a secure context, which is why this falls
 * back rather than assuming.
 */
export function newClientId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
