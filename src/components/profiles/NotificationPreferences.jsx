/**
 * Per-kind notification preferences.
 *
 * Three switches per kind — in-app, email, push — over the list the
 * server returns. Two things about that list shape this component:
 *
 * * **Every kind is present, always.** `NotificationPreference` stores
 *   only deviations from the defaults, so the server resolves the
 *   defaults and returns a row per kind. A row with `is_default: true`
 *   has never been saved, which is why the page can say "using the
 *   default" rather than implying the user chose something.
 * * **A switch saves immediately.** There is no Save button because there
 *   is no form: each toggle PATCHes its own kind. A settings page that
 *   silently discards a change because someone navigated away is a
 *   support ticket.
 *
 * The email default is the interesting column. `ANNOUNCEMENT` is off by
 * default and `NEW_MATCH`/`NEW_MESSAGE` are on — the server owns that
 * decision (`EMAIL_DEFAULT_KINDS`) and this screen only displays it, so
 * the two cannot disagree.
 */

import { Badge } from '../ui/Badge'
import { ErrorState } from '../ui/States'
import { Spinner } from '../ui/Spinner'
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from '../../hooks/useNotifications'

/**
 * One switch.
 *
 * A real `<button role="switch">` rather than a styled checkbox: it is
 * keyboard-operable, and `aria-checked` is what a screen reader
 * announces. The visual track is decoration on top of that.
 */
function Switch({ id, label, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full',
        'transition-colors duration-fast ease-smooth',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-sand-300 dark:bg-sand-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm',
          'transition-transform duration-fast ease-smooth',
          checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.19rem]',
        ].join(' ')}
      />
    </button>
  )
}

/** A row's three switches, with a heading per column on the first row. */
function PreferenceRow({ row, isPending, onChange }) {
  const isPushAvailable = false // No push provider is wired yet.

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {row.kind_display ?? row.kind}
        </p>
        {row.is_default ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Using the default</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Switch
          id={`${row.kind}-in-app`}
          label={`${row.kind_display ?? row.kind} in-app notifications`}
          checked={Boolean(row.in_app)}
          disabled={isPending}
          onChange={(value) => onChange({ kind: row.kind, in_app: value })}
        />
        <Switch
          id={`${row.kind}-email`}
          label={`${row.kind_display ?? row.kind} email notifications`}
          checked={Boolean(row.email)}
          disabled={isPending}
          onChange={(value) => onChange({ kind: row.kind, email: value })}
        />
        <Switch
          id={`${row.kind}-push`}
          label={`${row.kind_display ?? row.kind} push notifications`}
          checked={Boolean(row.push)}
          disabled={isPending || !isPushAvailable}
          onChange={(value) => onChange({ kind: row.kind, push: value })}
        />
      </div>
    </div>
  )
}

export function NotificationPreferences() {
  const { data, isLoading, isError, error, refetch } = useNotificationPreferences()
  const update = useUpdateNotificationPreference()

  const rows = Array.isArray(data) ? data : []

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="heading-section">
            Notifications
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Choose what you are told about and where. Changes save as you make
            them.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} className="mt-4" />
      ) : (
        <>
          {/* Column headings, aligned over the switch columns. The labels
              are the accessible names too, so this is not decoration. */}
          <div className="mt-4 flex items-center gap-3 border-b border-sand-200 pb-2 dark:border-sand-800">
            <span className="eyebrow min-w-0 flex-1">
              Notify me about
            </span>
            <div className="flex items-center gap-4">
              {['In-app', 'Email', 'Push'].map((label) => (
                <span
                  key={label}
                  className="eyebrow w-9 text-center"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-sand-100 dark:divide-sand-800">
            {rows.map((row) => (
              <PreferenceRow
                key={row.kind}
                row={row}
                isPending={update.isPending && update.variables?.kind === row.kind}
                onChange={(payload) => update.mutate(payload)}
              />
            ))}
          </div>

          {update.isError ? (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {update.error?.message ?? 'That change could not be saved.'}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-4 dark:border-sand-800">
            <Badge tone="neutral">
              {rows.filter((row) => row.email).length} of {rows.length} emailed
            </Badge>
            {/* Push has a column and a stored value but no provider, so it
                is disabled rather than hidden — a control that vanishes
                is harder to explain than one that says why it is off. */}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Push notifications need a mobile app; the switch is reserved for it.
            </span>
          </div>
        </>
      )}
    </section>
  )
}
