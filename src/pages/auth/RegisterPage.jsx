/**
 * Sign up.
 *
 * Two things that differ from a typical signup form:
 *
 * 1. **No tokens come back.** The account is created unverified and
 *    `login/` refuses until the emailed token is consumed, so this hands
 *    off to the verification screen rather than into the app.
 * 2. **The password rules are Django's**, not a simple length check —
 *    length, common-password, all-numeric and similarity-to-the-email.
 *    The client checks the ones it can so the user is not round-tripping
 *    for an obvious mistake, but the server's list is authoritative and
 *    its messages are surfaced verbatim.
 *
 * Date of birth is collected here because it is a hard gate: the server's
 * `validate_birth_date` rejects anyone under 18, and a profile cannot be
 * scored without an age.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  Checkbox,
  FormError,
  Select,
  TextArea,
  TextField,
} from '../../components/ui/Form'
import { GENDERS, RELATIONSHIP_GOALS } from '../../utils/constants'
import { ageFromDateOfBirth } from '../../utils/format'
import { register } from '../../services/auth'

const MIN_PASSWORD_LENGTH = 10

/** A rough strength read, shown as guidance rather than a gate. */
function passwordHints(password) {
  return [
    { label: `${MIN_PASSWORD_LENGTH}+ characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: 'Not entirely numeric', met: /[^\d]/.test(password) },
    { label: 'Mixed case', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'A number or symbol', met: /[\d\W]/.test(password) },
  ]
}

export function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    city: '',
    country: '',
    relationship_goal: '',
    accept_tos: false,
  })
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (field) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
  }

  const age = ageFromDateOfBirth(form.date_of_birth)
  const isUnderage = age !== null && age < 18
  const hints = useMemo(() => passwordHints(form.password), [form.password])
  const passwordsMatch =
    form.password_confirm.length > 0 && form.password === form.password_confirm

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (form.password !== form.password_confirm) {
      setError({
        message: 'The two passwords do not match.',
        fieldErrors: { password_confirm: ['The two passwords do not match.'] },
      })
      return
    }
    if (isUnderage) {
      setError({ message: 'You must be at least 18 to use VibeMatch.' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        // Empty strings are rejected by the ChoiceFields, so they are
        // omitted rather than sent blank.
        gender: form.gender || undefined,
        relationship_goal: form.relationship_goal || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
      })

      navigate('/verify-email', {
        replace: true,
        state: {
          email: result.email,
          // Only present when mail is going to the console, which is the
          // default in development. The verify screen offers a shortcut
          // when it is.
          debugToken: result.debug_verification_token,
        },
      })
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
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          It takes a minute. You can fill in the rest later.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
        <FormError error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={update('first_name')}
            autoComplete="given-name"
            required
            error={error?.fieldErrors?.first_name}
          />
          <TextField
            label="Last name"
            name="last_name"
            value={form.last_name}
            onChange={update('last_name')}
            autoComplete="family-name"
            error={error?.fieldErrors?.last_name}
          />
        </div>

        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={update('email')}
          autoComplete="email"
          required
          error={error?.fieldErrors?.email}
        />

        <div>
          <TextField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            required
            error={error?.fieldErrors?.password}
          />
          {form.password ? (
            <ul className="mt-2 grid grid-cols-2 gap-1">
              {hints.map((hint) => (
                <li
                  key={hint.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    hint.met
                      ? 'text-sage-600 dark:text-sage-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span aria-hidden="true">{hint.met ? '✓' : '○'}</span>
                  {hint.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <TextField
          label="Confirm password"
          name="password_confirm"
          type="password"
          value={form.password_confirm}
          onChange={update('password_confirm')}
          autoComplete="new-password"
          required
          error={error?.fieldErrors?.password_confirm}
          hint={
            form.password_confirm && !passwordsMatch
              ? undefined
              : passwordsMatch
                ? 'Passwords match.'
                : undefined
          }
        />

        <TextField
          label="Date of birth"
          name="date_of_birth"
          type="date"
          value={form.date_of_birth}
          onChange={update('date_of_birth')}
          required
          max={new Date().toISOString().slice(0, 10)}
          error={
            isUnderage
              ? ['You must be at least 18 to use VibeMatch.']
              : error?.fieldErrors?.date_of_birth
          }
          hint={!isUnderage && age ? `You are ${age}.` : undefined}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="I am a"
            name="gender"
            value={form.gender}
            onChange={update('gender')}
            options={GENDERS}
            placeholder="Prefer not to say"
            error={error?.fieldErrors?.gender}
          />
          <Select
            label="Looking for"
            name="relationship_goal"
            value={form.relationship_goal}
            onChange={update('relationship_goal')}
            options={RELATIONSHIP_GOALS}
            placeholder="Not sure yet"
            error={error?.fieldErrors?.relationship_goal}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="City"
            name="city"
            value={form.city}
            onChange={update('city')}
            autoComplete="address-level2"
            hint="Used for distance — never shown exactly."
            error={error?.fieldErrors?.city}
          />
          <TextField
            label="Country"
            name="country"
            value={form.country}
            onChange={update('country')}
            autoComplete="country-name"
            error={error?.fieldErrors?.country}
          />
        </div>

        <Checkbox
          name="accept_tos"
          checked={form.accept_tos}
          onChange={update('accept_tos')}
          label="I agree to the Terms of Service and Privacy Policy"
        />
        {error?.fieldErrors?.accept_tos ? (
          <p className="-mt-3 text-sm text-red-600 dark:text-red-400">
            {error.fieldErrors.accept_tos[0]}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || isUnderage}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
