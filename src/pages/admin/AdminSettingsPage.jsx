/**
 * Site settings and feature flags.
 *
 * Settings are stored as JSON with a `value_type`, so **the editor has to
 * be chosen per row** rather than per form. A boolean rendered as a text
 * box would send the string `"false"`, which is truthy — that is the bug
 * this page exists to avoid, and it is why the control is picked from
 * `value_type` and not guessed from the current value's JS type (a
 * setting whose value happens to be `null` would guess wrong).
 *
 * `is_editable` is enforced server-side: a non-editable row is rejected
 * with a 400 even if the request is forged. The control is disabled here
 * so the reason is visible rather than the save failing mysteriously.
 *
 * The flags below the settings are a different mechanism — they are
 * cached in `core.flags`, and the server invalidates that cache on write.
 * They are not editable through the settings list even though they live
 * in the same table, because writing the row directly would leave the
 * cache serving the old value.
 */

import { useEffect, useMemo, useState } from 'react'

import { PageHeader, Panel } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { Checkbox, FormError, TextArea, TextField } from '../../components/ui/Form'
import { ErrorState, RowListSkeleton } from '../../components/ui/States'
import {
  useAdminFlags,
  useAdminSettings,
  useUpdateFeatureFlag,
  useUpdateSetting,
} from '../../hooks/useAdmin'
import { formatDateTime } from '../../utils/format'

/** Human-readable label for a setting key when the row has no `label`. */
function humanise(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase())
}

/**
 * Turn a stored JSON value into the string an input can hold.
 *
 * JSON rows are pretty-printed because the admin is editing a structure,
 * not a value, and a one-line blob is unreadable. Everything else is
 * stringified plainly.
 */
function toDraftText(setting) {
  if (setting.value == null) return ''
  if (setting.value_type === 'json') return JSON.stringify(setting.value, null, 2)
  return String(setting.value)
}

/**
 * Turn the typed text back into the type the server expects.
 *
 * Returns `{ ok, value, error }` rather than throwing, because the caller
 * needs to render the error next to the field instead of losing the
 * whole save.
 */
function fromDraftText(setting, text) {
  switch (setting.value_type) {
    case 'integer': {
      const parsed = Number.parseInt(text, 10)
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: 'Must be a whole number.' }
      }
      return { ok: true, value: parsed }
    }
    case 'float': {
      const parsed = Number.parseFloat(text)
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: 'Must be a number.' }
      }
      return { ok: true, value: parsed }
    }
    case 'json': {
      try {
        return { ok: true, value: JSON.parse(text) }
      } catch {
        return { ok: false, error: 'Not valid JSON.' }
      }
    }
    default:
      return { ok: true, value: text }
  }
}

function SettingField({ setting, text, onChange, disabled }) {
  const label = setting.label || humanise(setting.key)
  const hint = setting.description || undefined

  if (setting.value_type === 'boolean') {
    return (
      <div>
        <Checkbox
          label={label}
          name={`setting-${setting.key}`}
          checked={text === 'true'}
          onChange={(checked) => onChange(checked ? 'true' : 'false')}
          disabled={disabled}
        />
        {hint ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    )
  }

  if (setting.value_type === 'json') {
    return (
      <TextArea
        label={label}
        name={`setting-${setting.key}`}
        value={text}
        onChange={onChange}
        rows={6}
        disabled={disabled}
        hint={hint ?? 'Edited as JSON.'}
        className="font-mono text-xs"
      />
    )
  }

  return (
    <TextField
      label={label}
      name={`setting-${setting.key}`}
      type={setting.value_type === 'string' ? 'text' : 'number'}
      value={text}
      onChange={onChange}
      disabled={disabled}
      hint={hint}
    />
  )
}

export function AdminSettingsPage() {
  const settingsQuery = useAdminSettings()
  const flagsQuery = useAdminFlags()
  const updateSetting = useUpdateSetting()
  const updateFlag = useUpdateFeatureFlag()

  const [drafts, setDrafts] = useState({})
  const [errors, setErrors] = useState({})

  // Seed each row's draft from the server. Re-seeding on every fetch is
  // deliberate: after a save the server is the truth, and a draft that
  // survived would show the typed value even if the server stored
  // something different (a coerced number, a normalised string).
  useEffect(() => {
    if (!settingsQuery.data) return
    const next = {}
    for (const setting of settingsQuery.data) next[setting.key] = toDraftText(setting)
    setDrafts(next)
    setErrors({})
  }, [settingsQuery.data])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const setting of settingsQuery.data ?? []) {
      const group = setting.group || 'general'
      if (!map.has(group)) map.set(group, [])
      map.get(group).push(setting)
    }
    return [...map.entries()]
  }, [settingsQuery.data])

  if (settingsQuery.isError) {
    return (
      <>
        <PageHeader title="Settings" description="Site configuration and feature flags." />
        <ErrorState error={settingsQuery.error} onRetry={settingsQuery.refetch} />
      </>
    )
  }

  if (settingsQuery.isLoading) {
    return (
      <>
        <PageHeader title="Settings" description="Site configuration and feature flags." />
        <div className="card p-4">
          <RowListSkeleton count={6} />
        </div>
      </>
    )
  }

  const save = (setting) => {
    const result = fromDraftText(setting, drafts[setting.key] ?? '')
    if (!result.ok) {
      setErrors((previous) => ({ ...previous, [setting.key]: result.error }))
      return
    }
    setErrors((previous) => {
      const next = { ...previous }
      delete next[setting.key]
      return next
    })
    updateSetting.mutate({ key: setting.key, value: result.value })
  }

  const isDirty = (setting) => {
    const original = toDraftText(setting)
    return (drafts[setting.key] ?? '') !== original
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Site configuration and feature flags. Changes are recorded in the audit log."
      />

      {grouped.map(([group, settings]) => (
        <Panel
          key={group}
          title={humanise(group)}
          description={`${settings.length} setting${settings.length === 1 ? '' : 's'}.`}
        >
          <div className="space-y-5">
            {settings.map((setting) => (
              <div key={setting.key} className="border-b border-sand-100 pb-5 last:border-0 last:pb-0 dark:border-sand-800">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <code className="text-xs text-slate-400 dark:text-slate-500">
                    {setting.key}
                  </code>
                  <Badge tone="neutral">{setting.value_type}</Badge>
                  {setting.is_public ? <Badge tone="info">Public</Badge> : null}
                  {!setting.is_editable ? (
                    <Badge tone="warning">Read-only</Badge>
                  ) : null}
                  {setting.updated_by_name ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Last changed by {setting.updated_by_name} ·{' '}
                      {formatDateTime(setting.updated_at)}
                    </span>
                  ) : null}
                </div>

                <SettingField
                  setting={setting}
                  text={drafts[setting.key] ?? ''}
                  onChange={(value) =>
                    setDrafts((previous) => ({ ...previous, [setting.key]: value }))
                  }
                  disabled={!setting.is_editable}
                />

                {errors[setting.key] ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors[setting.key]}
                  </p>
                ) : null}

                {setting.is_editable ? (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => save(setting)}
                      disabled={!isDirty(setting) || updateSetting.isPending}
                    >
                      Save
                    </button>
                    {isDirty(setting) ? (
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:underline dark:text-slate-400"
                        onClick={() =>
                          setDrafts((previous) => ({
                            ...previous,
                            [setting.key]: toDraftText(setting),
                          }))
                        }
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    The application depends on this value structurally, so it is
                    not editable from the dashboard.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      ))}

      <FormError error={updateSetting.error} />

      <Panel
        title="Feature flags"
        description="Switches that take effect without a deploy."
      >
        {flagsQuery.isError ? (
          <ErrorState error={flagsQuery.error} onRetry={flagsQuery.refetch} />
        ) : flagsQuery.isLoading ? (
          <RowListSkeleton count={7} />
        ) : (
          <div className="space-y-3">
            {(flagsQuery.data ?? []).map((flag) => (
              <div
                key={flag.name}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-100 pb-3 last:border-0 last:pb-0 dark:border-sand-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {flag.label}
                  </p>
                  <code className="text-xs text-slate-400 dark:text-slate-500">
                    {flag.name}
                  </code>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={Boolean(flag.enabled)}
                    disabled={updateFlag.isPending}
                    onChange={(event) =>
                      updateFlag.mutate({
                        name: flag.name,
                        enabled: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  {flag.enabled ? 'On' : 'Off'}
                </label>
              </div>
            ))}
          </div>
        )}

        <FormError error={updateFlag.error} />

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Flags are cached in-process. The server invalidates that cache when a
          flag is flipped here, so a change takes effect immediately rather than
          after the cache expires.
        </p>
      </Panel>
    </div>
  )
}
