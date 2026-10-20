/**
 * Sign in.
 *
 * The one behaviour worth calling out: a 403 with
 * `error.code === 'email_not_verified'` is not a credential failure, so it
 * routes to the verification screen with the address prefilled rather
 * than showing a red "wrong password" style error.
 */

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { FormError, TextField } from '../../components/ui/Form'
import { useAuth } from '../../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = location.state?.from?.pathname ?? '/app'

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email.trim().toLowerCase(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err.code === 'email_not_verified') {
        navigate('/verify-email', { replace: true, state: { email } })
        return
      }
      setError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <div className="mb-8 text-center">
        <h1 className="heading-display">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to see who is waiting for you.
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
          // The server reports field errors under the serializer's names;
          // `ApiError.fieldErrors` is keyed the same way.
          error={error?.fieldErrors?.email}
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          error={error?.fieldErrors?.password}
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          New here?{' '}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Create an account
          </Link>
        </p>
      </form>
    </div>
  )
}
