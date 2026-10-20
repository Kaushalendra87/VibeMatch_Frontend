/**
 * Browser crash reporting.
 *
 * A React render error unmounts the tree and leaves a blank page; nothing
 * about it reaches the server, so the only signal is a support message
 * saying "it went white". This posts what happened to
 * `POST /api/errors/client/`, which records it beside the server-side
 * failures.
 *
 * Deliberately uses a bare `fetch`, not the shared Axios instance:
 *
 * 1. **The Axios instance is a suspect.** A crash could have been caused
 *    by the interceptor, the token refresh, or a response shape — and a
 *    reporter that routes through the thing it is reporting on can fail
 *    for the same reason the page did.
 * 2. **No auth, no refresh.** The endpoint is unauthenticated by design
 *    (the failure worth catching most happens during sign-in), and a 401
 *    from here must never trigger the refresh-and-replay path.
 * 3. **It must never throw.** `keepalive` lets the request outlive the
 *    unmounting page.
 *
 * Nothing here is awaited by a caller that cares: reporting is
 * fire-and-forget, because a failure to report must not change what the
 * user sees.
 */

const REPORT_URL = '/api/errors/client'

/** Bounds mirrored from the server so a huge stack is trimmed before it
 *  leaves the browser, rather than being rejected after a round trip. */
const MAX_MESSAGE = 1000
const MAX_STACK = 4000
const MAX_PATH = 500

/**
 * Report one browser-side failure.
 *
 * `component` names the boundary that caught it, so the admin's "where"
 * column reads as a screen rather than a URL.
 */
export function reportClientError({ message, stack, component } = {}) {
  const text = String(message ?? '').slice(0, MAX_MESSAGE)
  if (!text) return

  // `location.pathname` only — never the full URL. A query string can
  // carry a password-reset token or a search term, and a crash report is
  // not a licence to exfiltrate the page the user was on.
  const path =
    typeof window !== 'undefined' && window.location
      ? String(window.location.pathname || '').slice(0, MAX_PATH)
      : ''

  const body = JSON.stringify({
    message: text,
    stack: stack ? String(stack).slice(0, MAX_STACK) : '',
    component: component ? String(component).slice(0, 255) : '',
    path,
  })

  try {
    // Not awaited, and any rejection is swallowed: the user is already
    // looking at a broken screen, and a second error surfaced from the
    // error reporter would be worse than silence.
    fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // `fetch` itself can throw synchronously in exotic cases (a blocked
    // request, a detached document). Swallowed for the same reason.
  }
}
