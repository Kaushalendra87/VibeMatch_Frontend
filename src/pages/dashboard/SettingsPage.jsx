/**
 * Settings — match preferences, notifications, and the account.
 *
 * The preferences here are **deal-breakers, not filters.** The scorer
 * applies them before anyone reaches the feed, so a preference can only
 * ever remove people. That is why saving them invalidates the feed cache
 * (`useUpdateMyPreference` does it) and why the copy on this page says so
 * — a user who sets "women only" and then sees no men has not found a
 * bug, and the page should have told them that up front.
 *
 * The danger zone at the bottom is the GDPR half of the spec: an export
 * and a deletion. Both live in the accounts app and are wired to real
 * endpoints, and so are the notification preferences — `notifications/
 * urls.py` serves `preferences/`, and `NotificationPreferences` below is
 * a real editor over it.
 *
 * An earlier version of this docstring said the notifications app was
 * models-only with `urlpatterns = []`, and the page showed a "Coming
 * soon" card on that basis. Both were stale: the routes had landed and
 * nothing pointed at them.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Checkbox,
  CheckboxGroup,
  RangeField,
  TextArea,
  TextField,
} from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { ErrorState } from '../../components/ui/States'
import { LoadingState } from '../../components/ui/Spinner'
import { NotificationPreferences } from '../../components/profiles/NotificationPreferences'
import { useInterests, useMyPreference, useUpdateMyPreference } from '../../hooks/useProfile'
import { useAuth } from '../../context/AuthContext'
import * as authApi from '../../services/auth'
import { GENDER_PREFERENCES, RELATIONSHIP_GOALS } from '../../utils/constants'

/**
 * A tag picker that toggles one value in an interest list.
 *
 * Declared at module scope, **not** inside `PreferenceForm`. A component
 * defined during render is a new type on every render, so React unmounts
 * and remounts it — which loses focus and scroll position mid-selection.
 *
 * `disabledIds` is the other side's list: an interest cannot be both
 * required and excluded, and the server rejects the combination, so the
 * already-chosen ones are disabled here rather than erroring on save.
 */
function InterestPicker({ label, hint, value, options, disabledIds, onChange }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="scrollbar-thin flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-sand-200 p-2 dark:border-sand-800">
        {options.map((interest) => {
          const selected = value.includes(interest.id)
          const disabled = disabledIds.includes(interest.id)
          return (
            <button
              key={interest.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((id) => id !== interest.id)
                    : [...value, interest.id],
                )
              }
              className={[
                'badge transition-colors',
                selected
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                disabled ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              {interest.name}
            </button>
          )
        })}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

function PreferenceForm() {
  const preference = useMyPreference()
  const interestsQuery = useInterests({ pageSize: 100 })
  const update = useUpdateMyPreference()

  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!preference.data || draft) return
    setDraft({
      min_age: preference.data.min_age ?? 18,
      max_age: preference.data.max_age ?? 99,
      max_distance_km: preference.data.max_distance_km ?? 50,
      genders: preference.data.genders ?? [],
      preferred_goals: preference.data.preferred_goals ?? [],
      min_height_cm: preference.data.min_height_cm ?? '',
      max_height_cm: preference.data.max_height_cm ?? '',
      only_verified: preference.data.only_verified ?? false,
      only_with_photos: preference.data.only_with_photos ?? false,
      // These arrive as ids and are sent back as ids — unlike the profile's
      // `interests`, this field has the same shape in both directions.
      required_interests: preference.data.required_interests ?? [],
      excluded_interests: preference.data.excluded_interests ?? [],
    })
  }, [preference.data, draft])

  if (preference.isLoading || !draft) return <LoadingState message="Loading preferences…" />
  if (preference.isError) {
    return <ErrorState error={preference.error} onRetry={preference.refetch} />
  }

  const interests = interestsQuery.data?.results ?? []
  const set = (patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    setSaved(false)
  }

  const save = async (event) => {
    event.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await update.mutateAsync({
        ...draft,
        min_height_cm: draft.min_height_cm === '' ? null : Number(draft.min_height_cm),
        max_height_cm: draft.max_height_cm === '' ? null : Number(draft.max_height_cm),
      })
      setSaved(true)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <form onSubmit={save} className="card p-5">
      <h2 className="heading-section">
        Match preferences
      </h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        These are applied before anyone reaches your feed. They can only narrow
        who you see — never widen it.
      </p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <RangeField
            label="Minimum age"
            name="pref-min-age"
            value={draft.min_age}
            min={18}
            max={99}
            onChange={(event) => set({ min_age: Number(event.target.value) })}
          />
          <RangeField
            label="Maximum age"
            name="pref-max-age"
            value={draft.max_age}
            min={18}
            max={99}
            onChange={(event) => set({ max_age: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-4">
          <RangeField
            label="Maximum distance"
            name="pref-distance"
            value={draft.max_distance_km}
            min={1}
            max={500}
            step={5}
            formatValue={(value) => `${value} km`}
            onChange={(event) => set({ max_distance_km: Number(event.target.value) })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Min height (cm)"
              name="pref-min-height"
              type="number"
              value={draft.min_height_cm}
              onChange={(event) => set({ min_height_cm: event.target.value })}
              min={100}
              max={250}
            />
            <TextField
              label="Max height (cm)"
              name="pref-max-height"
              type="number"
              value={draft.max_height_cm}
              onChange={(event) => set({ max_height_cm: event.target.value })}
              min={100}
              max={250}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <CheckboxGroup
          label="Show me"
          options={GENDER_PREFERENCES}
          value={draft.genders}
          onChange={(genders) => set({ genders })}
          hint="Leave empty to see everyone."
        />

        <CheckboxGroup
          label="Preferred relationship goals"
          options={RELATIONSHIP_GOALS}
          value={draft.preferred_goals}
          onChange={(preferred_goals) => set({ preferred_goals })}
        />

        <InterestPicker
          label="Must share at least one of"
          hint="People without any of these are excluded from your feed."
          value={draft.required_interests}
          options={interests}
          disabledIds={draft.excluded_interests}
          onChange={(required_interests) => set({ required_interests })}
        />

        <InterestPicker
          label="Hide people interested in"
          value={draft.excluded_interests}
          options={interests}
          disabledIds={draft.required_interests}
          onChange={(excluded_interests) => set({ excluded_interests })}
        />

        <div className="space-y-3">
          <Checkbox
            label="Only show verified profiles"
            name="only_verified"
            checked={draft.only_verified}
            onChange={(event) => set({ only_verified: event.target.checked })}
          />
          <Checkbox
            label="Only show people with photos"
            name="only_with_photos"
            checked={draft.only_with_photos}
            onChange={(event) => set({ only_with_photos: event.target.checked })}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save preferences'}
        </button>
        {saved ? (
          <span role="status" className="text-sm text-sage-600 dark:text-sage-400">
            Saved — your feed has been refreshed
          </span>
        ) : null}
      </div>
    </form>
  )
}

/**
 * The account section: export and deletion.
 *
 * Deletion is **not** a `ConfirmDialog`. The server requires the account
 * password *and* the literal phrase `DELETE MY ACCOUNT`, and a two-button
 * dialog has nowhere to collect either. So this is a form inside a modal,
 * with the confirmation phrase checked client-side too — not as security
 * (the server enforces it) but so the user finds out they mistyped before
 * a round-trip.
 */
function DeleteAccountDialog({ isOpen, onClose, onDeleted }) {
  const { logout } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const phrase = authApi.DELETION_CONFIRMATION_PHRASE
  const phraseMatches = confirm.trim().toUpperCase() === phrase

  const reset = () => {
    setPassword('')
    setConfirm('')
    setReason('')
    setError(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!phraseMatches) return

    setError(null)
    setIsDeleting(true)
    try {
      await authApi.deleteAccount(password, confirm, reason)
      // The server has anonymised the account and cleared the refresh
      // cookie; the local session has to follow.
      await logout()
      onDeleted?.()
    } catch (err) {
      setIsDeleting(false)
      setError(err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Delete your account"
      description="This cannot be undone."
      size="md"
      // Dismissing mid-request would leave the caller unable to report
      // the outcome of an irreversible action.
      dismissible={!isDeleting}
    >
      <form id="delete-account-form" onSubmit={submit} className="space-y-4">
        <div className="alert-error">
          Your profile is anonymised, your matches and conversations are closed,
          and you are signed out. Export your data first if you want a copy.
        </div>

        <TextField
          label="Your password"
          name="delete-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          error={error?.fieldErrors?.password}
        />

        <TextField
          label={`Type "${phrase}" to confirm`}
          name="delete-confirm"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder={phrase}
          required
          autoComplete="off"
          error={error?.fieldErrors?.confirm}
          hint={
            confirm && !phraseMatches ? 'That does not match exactly.' : undefined
          }
        />

        <TextArea
          label="Why are you leaving? (optional)"
          name="delete-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
        />

        {error && !error.hasFieldErrors ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            reset()
            onClose()
          }}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="delete-account-form"
          className="btn-danger"
          disabled={isDeleting || !phraseMatches || !password}
        >
          {isDeleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </Modal>
  )
}

function AccountSection() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [exportDone, setExportDone] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const onExport = async () => {
    setExportError(null)
    setExportDone(false)
    setIsExporting(true)
    try {
      const blob = await authApi.exportData()
      // The response is the document itself. Turning it into a blob
      // download keeps the access token out of the URL — a plain link
      // would have to carry it as a query parameter, where it ends up in
      // browser history and server access logs.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vibematch-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setExportDone(true)
    } catch (error) {
      setExportError(error.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="heading-section">
        Your account
      </h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Download everything we hold about you, or close your account.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand-200 p-4 dark:border-sand-800">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Export your data
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Profile, photos, matches, messages and preferences as a JSON file.
              Limited to a few downloads a day.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? 'Preparing…' : 'Download'}
          </button>
        </div>

        {exportError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {exportError}
          </p>
        ) : null}
        {exportDone ? (
          <p role="status" className="text-sm text-sage-600 dark:text-sage-400">
            Your export has been downloaded.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 p-4 dark:border-red-900">
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Delete your account
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your profile is anonymised and your matches and conversations are
              closed. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete account
          </button>
        </div>
      </div>

      <DeleteAccountDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
      />
    </section>
  )
}

export function SettingsPage() {
  const { user, hasActiveSubscription, planName } = useAuth()

  return (
    <div className="mx-auto max-w-narrow space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-display">
            Settings
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Who you see, who sees you, and what happens to your data.
          </p>
        </div>
        <Badge tone={hasActiveSubscription ? 'success' : 'neutral'}>
          {hasActiveSubscription ? (planName ?? 'Subscribed') : 'Free plan'}
        </Badge>
      </header>

      <PreferenceForm />

      <NotificationPreferences />

      {/* Privacy switches live on the profile page, because that is where
          the rest of the profile editor is. Linked rather than duplicated,
          so there is one place that writes those fields. */}
      <section className="card p-5">
        <h2 className="heading-section">
          Privacy
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Hide your profile, go incognito, and control what is shown about you.
        </p>
        <Link to="/app/profile" className="btn-secondary mt-4 inline-flex">
          Edit privacy settings
        </Link>
      </section>

      <section className="card p-5">
        <h2 className="heading-section">
          Safety
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Report someone, manage your blocked list, and read our safety guidance.
        </p>
        <Link to="/app/safety" className="btn-secondary mt-4 inline-flex">
          Open safety centre
        </Link>
      </section>

      <AccountSection />

      <p className="pb-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Signed in as {user?.email}
      </p>
    </div>
  )
}
