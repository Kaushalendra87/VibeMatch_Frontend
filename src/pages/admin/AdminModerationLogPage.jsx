/**
 * The moderator action log.
 *
 * Distinct from the audit log, and the difference matters. This records
 * actions taken *on users* — warns, suspensions, bans, content removals —
 * and is what an appeal is answered from. The audit log records actions
 * taken *by staff* on the system, including logins and setting changes.
 * Some entries appear in both, which is correct: they are two views of
 * the same events, indexed differently.
 *
 * Entries are immutable. There is no edit or delete here because there is
 * no edit or delete on the server — a moderation log that can be altered
 * is not evidence of anything.
 */

import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { useAdminModerationLog } from '../../hooks/useAdmin'
import { formatDateTime, formatTimeAgo } from '../../utils/format'

const ACTION_OPTIONS = [
  { value: 'none', label: 'No action' },
  { value: 'warn', label: 'Warn' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'ban', label: 'Ban' },
  { value: 'content_removed', label: 'Content removed' },
]

const TARGET_OPTIONS = [
  { value: 'report', label: 'Report' },
  { value: 'user', label: 'User' },
  { value: 'message', label: 'Message' },
  { value: 'photo', label: 'Photo' },
]

function actionTone(action) {
  return {
    ban: 'danger',
    suspend: 'warning',
    warn: 'info',
    content_removed: 'warning',
    none: 'neutral',
  }[action] ?? 'neutral'
}

export function AdminModerationLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') || 1)
  const action = searchParams.get('action') || ''
  const targetType = searchParams.get('target_type') || ''

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

  const { data, isLoading, isError, error, refetch } = useAdminModerationLog({
    page,
    action,
    targetType,
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
      key: 'moderator',
      header: 'Moderator',
      render: (row) =>
        row.moderator_name ? (
          <span className="text-slate-800 dark:text-slate-200">{row.moderator_name}</span>
        ) : (
          // A null moderator means the system acted, not a person — the
          // nightly job, or an automatic rule.
          <span className="text-slate-400 dark:text-slate-600">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge tone={actionTone(row.action)}>{row.action_display || row.action}</Badge>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <div>
          <p className="eyebrow">
            {row.target_type}
          </p>
          {row.target_user ? (
            <Link
              to={`/admin/users/${row.target_user}`}
              className="text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              User {row.target_user}
            </Link>
          ) : (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.target_id}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) =>
        row.reason ? (
          <span className="line-clamp-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            {row.reason}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Action log"
        description="Every moderation action taken on a user. Immutable."
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="log-action"
            label="Filter by action"
            value={action}
            onChange={(value) => updateParams({ action: value })}
            options={ACTION_OPTIONS}
            allLabel="All actions"
          />
          <FilterSelect
            id="log-target"
            label="Filter by target type"
            value={targetType}
            onChange={(value) => updateParams({ target_type: value })}
            options={TARGET_OPTIONS}
            allLabel="All targets"
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
        emptyTitle="No moderation actions"
        emptyDescription="Nothing has been actioned yet. Decisions made in the report queue appear here."
        caption="Moderation action log"
      />
    </div>
  )
}
