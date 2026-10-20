/**
 * Subscriptions.
 *
 * A read-only view, deliberately. There is no "cancel" button here: a
 * cancellation is the user's decision, made from their own account, and
 * an admin silently cancelling someone's subscription from a table row is
 * a support ticket waiting to happen. The admin *can* grant a
 * subscription — that endpoint exists and is documented as the seam a
 * payment webhook will call — but granting is not offered as a table
 * action because doing it from a list is too easy to do to the wrong row.
 *
 * Status is colour-coded but the word is always present.
 */

import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { useAdminSubscriptions } from '../../hooks/useAdmin'
import { formatDate } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
]

function statusTone(status) {
  return {
    active: 'success',
    trialing: 'info',
    past_due: 'warning',
    canceled: 'neutral',
    expired: 'neutral',
  }[status] ?? 'neutral'
}

export function AdminSubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') || ''
  const plan = searchParams.get('plan') || ''

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

  const { data, isLoading, isError, error, refetch } = useAdminSubscriptions({
    page,
    status,
    plan,
  })

  const columns = [
    {
      key: 'user',
      header: 'Subscriber',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.user_name || row.user_email || `User ${row.user}`}
          </p>
          {row.user_email ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.user_email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) => (
        <div>
          <p className="text-slate-800 dark:text-slate-200">{row.plan?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {row.plan?.price_display} / {row.plan?.interval_display}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(row.status)}>{row.status_display || row.status}</Badge>
          {row.cancel_at_period_end ? (
            // Distinct from "canceled": the subscription still works, it
            // just will not renew. Conflating them is a refund argument.
            <Badge tone="warning">Ends soon</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'current_period_end',
      header: 'Renews / ends',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDate(row.current_period_end)}
        </span>
      ),
    },
    {
      key: 'started_at',
      header: 'Started',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDate(row.started_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Who is paying, and what for."
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="sub-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
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
        emptyTitle="No subscriptions"
        emptyDescription="Nobody has subscribed yet. Plans are managed under Plans."
        caption="Subscriptions"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cancellations are the subscriber&rsquo;s decision and are made from their
        own account. See{' '}
        <Link to="/admin/billing/payments" className="text-brand-600 hover:underline dark:text-brand-400">
          Payments
        </Link>{' '}
        for refunds.
      </p>
    </div>
  )
}
