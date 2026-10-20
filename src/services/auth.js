/**
 * Authentication and account management.
 *
 * The token dance lives in `client.js`; this module only describes the
 * endpoints. The one thing worth knowing here: **registration does not
 * log you in.** The account starts unverified and `login/` refuses with
 * `error.code === 'email_not_verified'` until the emailed token is
 * consumed, so the register screen hands off to the verify screen rather
 * than into the app.
 */

import { api, bootstrapCsrf, setAccessToken } from './client'

export { bootstrapCsrf }

export async function register(payload) {
  const { data } = await api.post('/auth/register/', payload)
  return data
}

export async function verifyEmail(token) {
  const { data } = await api.post('/auth/verify-email/', { token })
  return data
}

export async function resendVerification(email) {
  const { data } = await api.post('/auth/resend-verification/', { email })
  return data
}

/**
 * Sign in. The access token is returned in the body; the refresh token is
 * set as an httpOnly cookie by the response and is never visible here.
 */
export async function login(email, password) {
  // A user who has never loaded the app has no CSRF cookie, and login is
  // CSRF-protected because it sets the refresh cookie.
  await bootstrapCsrf()
  const { data } = await api.post('/auth/login/', { email, password })
  setAccessToken(data.access)
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout/')
  } finally {
    // Clear locally even if the call failed — the user asked to leave.
    setAccessToken(null)
  }
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me/')
  return data
}

export async function updateMe(payload) {
  const { data } = await api.patch('/auth/me/', payload)
  return data
}

export async function changePassword(payload) {
  const { data } = await api.post('/auth/password/change/', payload)
  return data
}

export async function requestPasswordReset(email) {
  const { data } = await api.post('/auth/password/reset/', { email })
  return data
}

export async function confirmPasswordReset(payload) {
  const { data } = await api.post('/auth/password/reset/confirm/', payload)
  return data
}

export async function requestEmailChange(newEmail, password) {
  const { data } = await api.post('/auth/email/change/', {
    new_email: newEmail,
    password,
  })
  return data
}

export async function confirmEmailChange(token) {
  const { data } = await api.post('/auth/email/change/confirm/', { token })
  return data
}

// ── Sessions ─────────────────────────────────────────────────────────
export async function fetchSessions() {
  const { data } = await api.get('/auth/sessions/')
  return data
}

export async function revokeSession(jti) {
  await api.delete(`/auth/sessions/${jti}/`)
}

// ── GDPR ─────────────────────────────────────────────────────────────
/**
 * Build and download the data export.
 *
 * The server assembles the whole document synchronously and returns it
 * with `Content-Disposition: attachment`, so this is a normal JSON
 * response rather than a queued job — the caller turns the blob into a
 * download. Rate-limited server-side to a few requests per day.
 */
export async function exportData(options = {}) {
  const { data } = await api.post(
    '/auth/account/export/',
    {
      include_messages: options.includeMessages ?? true,
      include_matches: options.includeMatches ?? true,
      include_payments: options.includePayments ?? true,
    },
    { responseType: 'blob' },
  )
  return data
}

/**
 * Delete the account.
 *
 * Needs the password **and** the exact phrase `DELETE MY ACCOUNT` — the
 * server compares the confirmation string case-insensitively after
 * trimming, but not loosely enough to accept anything else. The account
 * is anonymised rather than hard-deleted, because payments and audit rows
 * reference it.
 */
export async function deleteAccount(password, confirm, reason = '') {
  const { data } = await api.post('/auth/account/delete/', {
    password,
    confirm,
    reason,
  })
  return data
}

/** The phrase the server requires, for the UI to show and check against. */
export const DELETION_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT'
