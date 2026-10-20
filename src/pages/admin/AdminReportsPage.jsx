/**
 * The report queue.
 *
 * Ordered by priority then recency, which is the model's own default
 * ordering — the server returns them in triage order, and re-sorting here
 * would undo it.
 *
 * Priority is a number where **1 is most urgent** (underage, threats) and
 * 5 is least. That inversion is the single easiest thing to get wrong on
 * this page, so it is rendered as a word — "Urgent", "High", "Normal",
 * "Low" — rather than as the raw digit.
 */

import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { RefreshingIndicator } from '../../components/ui/States'
import { useAdminReports } from '../../hooks/useAdmin'
import { formatTimeAgo } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

const PRIORITY_OPTIONS = [
  { value: '1', label: 'Urgent' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Low' },
  { value: '5', label: 'Minimal' },
]

/**
 * The priority ladder, spelled out.
 *
 * `1` is the most urgent — the model's help text says so and the
 * auto-priority rule sets it for underage and threats. Rendering the
 * digit alone invites reading `5` as the worst.
 */
const PRIORITY = {
  1: { label: 'Urgent', tone: 'danger' },
  2: { label: 'High', tone: 'warning' },
  3: { label: 'Normal', tone: 'info' },
  4: { label: 'Low', tone: 'neutral' },
  5: { label: 'Minimal', tone: 'neutral' },
}

function statusTone(status) {
  return {
    open: 'danger',
    in_review: 'warning',
    resolved: 'success',
    dismissed: 'neutral',
  }[status] ?? 'neutral'
}

export function AdminReportsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''

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

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminReports({
    page,
    status,
    priority,
  })

  const columns = [
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => {
        const meta = PRIORITY[row.priority] ?? { label: String(row.priority), tone: 'neutral' }
        return <Badge tone={meta.tone}>{meta.label}</Badge>
      },
    },
    {
      key: 'reported_user',
      header: 'Reported user',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.reported_user?.name || `User ${row.reported_user?.id}`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {row.reported_user?.email}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => row.reason_display || row.reason,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(row.status)}>{row.status_display || row.status}</Badge>
          {row.assigned_to ? (
            <Badge tone="neutral">Claimed</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'reports_against',
      header: 'Prior reports',
      align: 'right',
      render: (row) =>
        row.reported_user?.reports_against > 1 ? (
          // A user with several reports is the thing a moderator is
          // actually looking for, so it is called out rather than buried.
          <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
            {row.reported_user.reports_against}
          </span>
        ) : (
          <span className="tabular-nums text-slate-400 dark:text-slate-600">
            {row.reported_user?.reports_against ?? 0}
          </span>
        ),
    },
    {
      key: 'created_at',
      header: 'Filed',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatTimeAgo(row.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Triage order: most urgent first."
        actions={
          isFetching && !isLoading ? (
            <RefreshingIndicator isFetching className="py-0" />
          ) : null
        }
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="report-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
          <FilterSelect
            id="report-priority"
            label="Filter by priority"
            value={priority}
            onChange={(value) => updateParams({ priority: value })}
            options={PRIORITY_OPTIONS}
            allLabel="All priorities"
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
        onRowClick={(row) => navigate(`/admin/reports/${row.id}`)}
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
        emptyTitle={status || priority ? 'No reports match these filters' : 'The queue is empty'}
        emptyDescription={
          status || priority
            ? 'Try widening the filters.'
            : 'Nothing has been reported. This is the good outcome.'
        }
        caption="Report queue, most urgent first"
      />
    </div>
  )
}
