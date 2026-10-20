/**
 * Matching controls.
 *
 * **The weights are read by the scorer on every discovery request**, so a
 * change here alters what every user sees immediately. That is why the
 * editor is a deliberate save with a confirmation, not a live-updating
 * form, and why the "what this does" panel spells out the consequence
 * rather than just labelling the fields.
 *
 * The weights are **normalised by their own sum** at score time — see
 * `matching/services.py`. They do not have to add to 1, and this page
 * does not force them to: raising one weight relative to the others is a
 * meaningful edit, and renormalising the rest on save would undo it
 * silently.
 *
 * Reads and writes the existing `/matches/config/` endpoint, which is
 * already `IsAdmin` for writes. There is no separate admin route for it.
 */

import { useEffect, useState } from 'react'

import { PageHeader, Panel } from '../../components/admin/AdminUI'
import { FormError, TextField } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/Modal'
import { ErrorState, RowListSkeleton } from '../../components/ui/States'
import { useMatchingConfig, useUpdateMatchingConfig } from '../../hooks/useMatching'

/**
 * The score components, with what each one actually measures.
 *
 * The descriptions are the point of this list. "weight_age" means
 * nothing to someone who has not read the scorer; "how much a shared age
 * range matters" does.
 */
const WEIGHTS = [
  {
    field: 'weight_interests',
    label: 'Shared interests',
    help: 'Cosine similarity between the two interest sets.',
  },
  {
    field: 'weight_distance',
    label: 'Distance',
    help: 'Decays with distance, so a far-away profile scores lower rather than being excluded.',
  },
  {
    field: 'weight_age',
    label: 'Age',
    help: 'How closely the ages sit within each other’s preferred range.',
  },
  {
    field: 'weight_goals',
    label: 'Relationship goals',
    help: 'Full credit for the same goal, partial for a compatible family.',
  },
  {
    field: 'weight_activity',
    label: 'Activity',
    help: 'How recently each person was last active.',
  },
  {
    field: 'weight_completeness',
    label: 'Profile completeness',
    help: 'Favours profiles with photos and a filled-in bio.',
  },
]

const TUNABLES = [
  {
    field: 'bonus_verified',
    label: 'Verified bonus',
    help: 'Added to the score for a verified profile.',
  },
  {
    field: 'age_softness_years',
    label: 'Age softness (years)',
    help: 'How far outside a preferred range before the score falls off.',
  },
  {
    field: 'distance_softness_km',
    label: 'Distance softness (km)',
    help: 'Distance at which the distance component has decayed noticeably.',
  },
  {
    field: 'min_score_threshold',
    label: 'Minimum score',
    help: '0–1. Candidates below this are not shown at all.',
  },
  {
    field: 'feed_size',
    label: 'Feed size',
    help: 'How many candidates the feed considers before pagination.',
  },
  {
    field: 'max_inactive_days',
    label: 'Max inactive days',
    help: 'Profiles inactive longer than this drop out of discovery.',
  },
  {
    field: 'max_daily_likes',
    label: 'Free daily likes',
    help: 'Quota for users on the free tier. 0 means unlimited. Paid plans override this.',
  },
  {
    field: 'max_daily_super_likes',
    label: 'Free daily super likes',
    help: 'Free-tier super-like quota. 0 means unlimited.',
  },
]

export function AdminMatchingPage() {
  const { data, isLoading, isError, error, refetch } = useMatchingConfig()
  const updateConfig = useUpdateMatchingConfig()

  const [draft, setDraft] = useState({})
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  // Seed the draft from the server, and re-seed whenever it changes —
  // including after a successful save, so the form reflects what was
  // actually stored rather than what was typed.
  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  if (isError) {
    return (
      <>
        <PageHeader title="Matching" description="Score weights and discovery limits." />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Matching" description="Score weights and discovery limits." />
        <div className="card p-4">
          <RowListSkeleton count={6} />
        </div>
      </>
    )
  }

  const setField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }))
  }

  const changedFields = Object.keys(draft).filter(
    (key) => data && draft[key] !== data[key] && typeof draft[key] !== 'object',
  )
  const hasChanges = changedFields.length > 0

  const submit = () => {
    const payload = {}
    for (const key of changedFields) payload[key] = draft[key]
    updateConfig.mutate(payload, { onSuccess: () => setIsConfirmOpen(false) })
  }

  const weightSum = WEIGHTS.reduce(
    (total, entry) => total + Number(draft[entry.field] ?? 0),
    0,
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matching"
        description="How compatibility is scored. Changes apply to every new discovery request."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!hasChanges || updateConfig.isPending}
          >
            {updateConfig.isPending ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <Panel
        title="How this works"
        description="Read this before changing a weight."
      >
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Weights are relative.
            </strong>{' '}
            They are divided by their own sum when scoring, so they do not need
            to add to 1. Doubling one weight while leaving the rest alone makes
            it matter more; the others do not need adjusting.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Missing data is neutral, not zero.
            </strong>{' '}
            A user with no interests set is not penalised on the interests
            component — they score the midpoint. Penalising absence would rank
            new profiles below established ones for reasons they cannot see.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              The score is not a gate.
            </strong>{' '}
            It orders the feed. Only <em>Minimum score</em> excludes anyone.
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Current weights sum to {weightSum.toFixed(2)}. That is fine — it is a
          relative scale, not a percentage.
        </p>
      </Panel>

      <Panel title="Score weights" description="Higher means the component matters more.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WEIGHTS.map((entry) => (
            <TextField
              key={entry.field}
              label={entry.label}
              name={entry.field}
              type="number"
              value={draft[entry.field] ?? ''}
              onChange={(value) => setField(entry.field, Number(value))}
              hint={entry.help}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Tuning" description="Thresholds and limits.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUNABLES.map((entry) => (
            <TextField
              key={entry.field}
              label={entry.label}
              name={entry.field}
              type="number"
              value={draft[entry.field] ?? ''}
              onChange={(value) => setField(entry.field, Number(value))}
              hint={entry.help}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Boosts" description="Extra visibility for new profiles.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="New profile boost"
            name="new_profile_boost"
            type="number"
            value={draft.new_profile_boost ?? ''}
            onChange={(value) => setField('new_profile_boost', Number(value))}
            hint="Added to the score for a profile younger than the threshold."
          />
          <TextField
            label="Score cache seconds"
            name="score_cache_seconds"
            type="number"
            value={draft.score_cache_seconds ?? ''}
            onChange={(value) => setField('score_cache_seconds', Number(value))}
            hint="How long a computed pair score is reused."
          />
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.boost_new_profiles)}
                onChange={(event) => setField('boost_new_profiles', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
              />
              Boost new profiles
            </label>
          </div>
        </div>
      </Panel>

      <FormError error={updateConfig.error} />

      {hasChanges ? (
        <div className="alert-warning sticky bottom-4 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {changedFields.length} unsaved{' '}
            {changedFields.length === 1 ? 'change' : 'changes'}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDraft(data)}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsConfirmOpen(true)}
              disabled={updateConfig.isPending}
            >
              Save changes
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={submit}
        title="Change the matching weights?"
        description={`This affects what every user sees in discovery, starting with their next request. ${
          changedFields.length
        } field${changedFields.length === 1 ? '' : 's'} will change.`}
        confirmLabel="Apply changes"
        isPending={updateConfig.isPending}
      />
    </div>
  )
}
