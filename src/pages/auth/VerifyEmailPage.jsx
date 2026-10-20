/**
 * Email verification.
 *
 * Two entry points share this screen:
 *
 * * **After signup**, with the address in navigation state. The user
 *   pastes the token from their email, or — in development, where mail
 *   goes to the console — follows a shortcut that consumes the token the
 *   API returned in the registration response.
 * * **After a blocked login**, where the server answered 403 with
 *   `email_not_verified` and `details.can_resend`. The address is
 *   prefilled and a resend button is offered.
 *
 * It is deliberately outside `ProtectedRoute`: the user has no session
 * yet, which is the whole problem.
 */

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { FormError, FormSuccess, TextField } from '../../components/ui/Form'
import { resendVerification, verifyEmail } from '../../services/auth'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [token, setToken] = useState(location.state?.debugToken ?? '')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      await verifyEmail(token.trim())
      setMessage('Email confirmed. You can sign in now.')
      // A brief pause so the confirmation is readable before the redirect.
      setTimeout(() => navigate('/login', { replace: true, state: { email } }), 900)
    } catch (err) {
      setError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onResend = async () => {
    setError(null)
    setMessage(null)
    setIsResending(true)
    try {
      // Always answers 200, whether or not the address exists — the
      // endpoint cannot be used to enumerate accounts, so this message
      // must not imply the address was found.
      await resendVerification(email.trim().toLowerCase())
      setMessage(
        'If that account exists and is unverified, a new link is on its way.',
      )
    } catch (err) {
      setError(err)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h1 className="heading-display">
          Confirm your email
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {email ? (
            <>
              We sent a confirmation link to{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {email}
              </span>
              . Sign-in is blocked until it is confirmed.
            </>
          ) : (
            'Enter the token from your confirmation email.'
          )}
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <FormError error={error} />
        <FormSuccess message={message} />

        {location.state?.debugToken ? (
          // Only ever populated when the console email backend is in use.
          // Surfacing it here saves a trip to the terminal during
          // development, and it cannot appear in production because the
          // server only includes the field in that case.
          <div className="alert-warning text-xs">
            <p className="font-semibold">Development mode</p>
            <p className="mt-0.5">
              Mail is going to the console, so the token was included in the
              signup response and has been filled in for you.
            </p>
          </div>
        ) : null}

        <TextField
          label="Confirmation token"
          name="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste the token from your email"
          required
          autoComplete="one-time-code"
          error={error?.fieldErrors?.token}
        />

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || !token.trim()}
        >
          {isSubmitting ? 'Confirming…' : 'Confirm email'}
        </button>

        <div className="border-t border-sand-200 pt-4 dark:border-sand-800">
          <label htmlFor="resend-email" className="label">
            Did not get it? Resend to
          </label>
          <div className="flex gap-2">
            <input
              id="resend-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="input"
            />
            <button
              type="button"
              onClick={onResend}
              disabled={isResending || !email.trim()}
              className="btn-secondary shrink-0"
            >
              {isResending ? 'Sending…' : 'Resend'}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
