/**
 * The audit log.
 *
 * Every staff action on the system: logins, setting changes, role
 * changes, refunds, impersonation. Append-only at the model level, so
 * there is no edit or delete here — the server raises on update, and a
 * log that can be altered is not evidence.
 *
 * **`succeeded` is rendered explicitly, not implied.** A failed action is
 * still an action: a login that was rejected, a refund that errored. If
 * the table only showed successes, "who tried to do this and failed"
 * would be unanswerable, and that is often the more interesting question.
 * `error_message` is shown for the same reason.
 *
 * Filtering is by `action` and `succeeded`, both server-side. The action
 * list is long, so it is a select rather than free text — a typo in a
 * query param returns an empty list, which reads as "nothing happened"
 * rather than "you misspelled it".
 *
 * **Some filters can currently return nothing, and the page says so.**
 * The select mirrors `AuditAction` in full, but three of those values are
 * not written anywhere yet: `login_failed` (failures are recorded in
 * `LoginAttempt`, which is the brute-force table), `matching_config_update`
 * (config edits go to `MatchingConfigHistory`), and `user_suspend` /
 * `user_ban` (both are recorded as `user_update` with the new status in
 * `changes`). Offering them keeps the list a faithful mirror of the enum;
 * the note at the foot of the page stops an empty result being read as
 * "this never happens".
 */

import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { useAdminAuditLog } from '../../hooks/useAdmin'
import { formatDateTime, formatTimeAgo } from '../../utils/format'

/** The `AuditAction` choices, mirroring `core/constants.py`. */
const ACTION_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Failed login' },
  { value: 'logout', label: 'Logout' },
  { value: 'register', label: 'Register' },
  { value: 'password_change', label: 'Password change' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'profile_update', label: 'Profile update' },
  { value: 'account_delete', label: 'Account deletion' },
  { value: 'data_export', label: 'Data export' },
  { value: 'impersonate', label: 'Impersonate user' },
  { value: 'impersonate_end', label: 'End impersonation' },
  { value: 'user_update', label: 'Admin user update' },
  { value: 'user_suspend', label: 'Suspend user' },
  { value: 'user_ban', label: 'Ban user' },
  { value: 'user_delete', label: 'Delete user' },
  { value: 'verification_decide', label: 'Verification decision' },
  { value: 'report_decide', label: 'Report decision' },
  { value: 'matching_config_update', label: 'Matching config update' },
  { value: 'plan_create', label: 'Plan created' },
  { value: 'plan_update', label: 'Plan updated' },
  { value: 'plan_delete', label: 'Plan deleted' },
  { value: 'refund', label: 'Refund issued' },
  { value: 'subscription_activate', label: 'Subscription activated' },
  { value: 'subscription_cancel', label: 'Subscription cancelled' },
  { value: 'announcement_send', label: 'Announcement sent' },
  { value: 'settings_update', label: 'Site settings update' },
  { value: 'role_change', label: 'Role change' },
]

const OUTCOME_OPTIONS = [
  { value: 'true', label: 'Succeeded' },
  { value: 'false', label: 'Failed' },
]

/** Actions that are destructive regardless of direction. */
const DESTRUCTIVE = new Set([
  'user_delete',
  'account_delete',
  'plan_delete',
  'refund',
])

/**
 * Colour for one entry.
 *
 * **Role and status changes are written as a single `user_update`
 * action**, so the action name alone cannot tell a ban from a reactivation
 * — toning every `user_update` red would mark the reversals as destructive
 * too. The direction lives in `changes`, so that is what decides the
 * colour.
 */
function auditTone(action, changes) {
  if (DESTRUCTIVE.has(action)) return 'danger'
  if (action === 'login_failed' || action === 'impersonate') return 'warning'

  if (action === 'user_update') {
    const statusTo = changes?.status?.to
    if (statusTo === 'banned') return 'danger'
    if (statusTo === 'suspended') return 'warning'
    if (statusTo === 'active') return 'success'
    if (changes?.role) return 'warning'
  }

  return 'neutral'
}

/**
 * The verb, spelled out, because a bare "Admin user update" is ambiguous
 * for exactly the reason above.
 */
function describeChange(row) {
  const statusTo = row.changes?.status?.to
  if (statusTo === 'banned') return 'Banned user'
  if (statusTo === 'suspended') return 'Suspended user'
  if (statusTo === 'active') return 'Reactivated user'

  const roleTo = row.changes?.role?.to
  if (roleTo) return `Changed role to ${roleTo}`

  return row.action_display || row.action
}

export function AdminAuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') || 1)
  const action = searchParams.get('action') || ''
  const succeededParam = searchParams.get('succeeded') ?? ''

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === '' || value == null) next.delete(key)
            else next.set(key, String(value))
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // The server parses this itself (`"false"` must not become truthy the
  // way a JS `Boolean("false")` would), so it is passed through as a
  // string and left absent when unset.
  const { data, isLoading, isError, error, refetch } = useAdminAuditLog({
    page,
    action,
    succeeded: succeededParam === '' ? undefined : succeededParam === 'true',
  })

  const columns = [
    {
      key: 'created_at',
      header: 'When',
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-slate-800 dark:text-slate-200">
            {formatTimeAgo(row.created_at)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {formatDateTime(row.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) =>
        row.actor_email ? (
          <div>
            <p className="text-slate-800 dark:text-slate-200">
              {row.actor_name || row.actor_email}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.actor_email}</p>
          </div>
        ) : (
          // A null actor is the system acting, not a person — a scheduled
          // job or an automatic rule.
          <span className="text-slate-400 dark:text-slate-600">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={auditTone(row.action, row.changes)}>
            {describeChange(row)}
          </Badge>
          {row.succeeded ? null : <Badge tone="danger">Failed</Badge>}
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (row) =>
        row.target_repr || row.target_type ? (
          <div>
            {row.target_type ? (
              <p className="eyebrow">
                {row.target_type}
              </p>
            ) : null}
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {row.target_repr || row.target_id}
            </p>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'description',
      header: 'Detail',
      render: (row) => (
        <div>
          <p className="line-clamp-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            {row.description || '—'}
          </p>
          {row.impersonated_email ? (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              as {row.impersonated_email}
            </p>
          ) : null}
          {!row.succeeded && row.error_message ? (
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              {row.error_message}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {row.ip_address || '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every staff action, including the ones that failed."
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="audit-action"
            label="Filter by action"
            value={action}
            onChange={(value) => updateParams({ action: value })}
            options={ACTION_OPTIONS}
            allLabel="All actions"
          />
          <FilterSelect
            id="audit-outcome"
            label="Filter by outcome"
            value={succeededParam}
            onChange={(value) => updateParams({ succeeded: value })}
            options={OUTCOME_OPTIONS}
            allLabel="All outcomes"
          />
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
        emptyTitle="No audit entries"
        emptyDescription="Nothing matches these filters. Entries appear as staff act on the system."
        caption="Audit log"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Entries are append-only and cannot be edited or deleted from the
        dashboard — the server refuses an update at the model level. Failed
        logins are not in this log; they are recorded in the brute-force
        table instead. Suspensions and bans appear as{' '}
        <em>Admin user update</em> with the new status, not as their own
        action.
      </p>
    </div>
  )
}
