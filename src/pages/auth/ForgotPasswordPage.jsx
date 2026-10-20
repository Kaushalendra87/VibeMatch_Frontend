/**
 * Request a password reset.
 *
 * The response is identical whether or not the address exists — the
 * endpoint cannot be used to enumerate accounts — so the confirmation
 * message must not imply the address was found. This is why the success
 * state is worded conditionally and the screen never navigates onward.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { FormError, TextField } from '../../components/ui/Form'
import { requestPasswordReset } from '../../services/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [isSent, setIsSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email.trim().toLowerCase())
      setIsSent(true)
    } catch (err) {
      setError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSent) {
    return (
      <div className="mx-auto w-full max-w-form">
        <div className="card space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-sage-950 dark:text-sage-400">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h1 className="heading-section">
            Check your email
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            If an account exists for{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {email}
            </span>
            , a reset link is on its way. The link expires shortly, so use it soon.
          </p>
          <Link to="/login" className="btn-secondary w-full">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <div className="mb-8 text-center">
        <h1 className="heading-display">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          We will email you a link to set a new one.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <FormError error={error} />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          error={error?.fieldErrors?.email}
        />
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || !email.trim()}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
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
