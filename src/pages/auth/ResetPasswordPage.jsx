/**
 * Set a new password from a reset link.
 *
 * The token arrives as a query parameter (`?token=…`), which is what the
 * email link carries. It is read once into state rather than kept in the
 * URL, so a later navigation does not accidentally resubmit it.
 */

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { FormError, FormSuccess, TextField } from '../../components/ui/Form'
import { confirmPasswordReset } from '../../services/auth'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== passwordConfirm) {
      setError({
        message: 'The two passwords do not match.',
        fieldErrors: { new_password_confirm: ['The two passwords do not match.'] },
      })
      return
    }

    setIsSubmitting(true)
    try {
      await confirmPasswordReset({
        token: token.trim(),
        new_password: password,
        new_password_confirm: passwordConfirm,
      })
      setMessage('Password updated. Redirecting to sign in…')
      setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (err) {
      setError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <div className="mb-8 text-center">
        <h1 className="heading-display">
          Set a new password
        </h1>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <FormError error={error} />
        <FormSuccess message={message} />

        {!searchParams.get('token') ? (
          // A missing token means the user navigated here directly rather
          // than following the link, so the field is offered rather than
          // failing with a confusing validation error.
          <TextField
            label="Reset token"
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste the token from your email"
            required
            error={error?.fieldErrors?.token}
          />
        ) : null}

        <TextField
          label="New password"
          name="new_password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          hint="At least 10 characters."
          error={error?.fieldErrors?.new_password}
        />
        <TextField
          label="Confirm new password"
          name="new_password_confirm"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          autoComplete="new-password"
          required
          error={error?.fieldErrors?.new_password_confirm}
        />

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || !token.trim() || !password}
        >
          {isSubmitting ? 'Updating…' : 'Update password'}
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
