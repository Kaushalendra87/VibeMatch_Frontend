/**
 * The admin landing page.
 *
 * Reads the live overview, not the rollup — every figure here is labelled
 * "today" or "now", and a number read from a rollup written at 02:00
 * would be a day stale while looking current. The charts on the Analytics
 * page read the rollup instead, which is the right source for a range.
 *
 * `user_change_pct` and `revenue_change_pct` are `null` on a fresh
 * database — there is no prior 30-day window to compare against. They are
 * rendered as absent rather than as 0%, because "no change" and "nothing
 * to compare" are different claims.
 */

import { Link } from 'react-router-dom'

import { PageHeader, StatCard } from '../../components/admin/AdminUI'
import { ErrorState, Skeleton } from '../../components/ui/States'
import { useAdminOverview } from '../../hooks/useAdmin'
import { formatMoney, formatTimeAgo } from '../../utils/format'

/** A stat tile that shows a placeholder while the query is in flight. */
function LoadingCard() {
  return (
    <div className="card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  )
}

export function AdminOverviewPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminOverview()

  if (isError) {
    return (
      <>
        <PageHeader title="Overview" description="How the platform is doing right now." />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const cards = [
    { label: 'Total users', value: data?.total_users, change: data?.user_change_pct, hint: 'vs previous 30 days' },
    { label: 'New today', value: data?.new_users_today, hint: `${data?.new_users_7d ?? '—'} in the last 7 days` },
    { label: 'Active matches', value: data?.active_matches, hint: `${data?.total_matches ?? 0} all time` },
    { label: 'Match rate', value: data ? `${data.match_rate}%` : null, hint: 'matches per like, 30 days' },
  ]

  const health = [
    { label: 'Subscribers', value: data?.subscribers, tone: 'brand' },
    { label: 'MRR', value: data ? formatMoney(data.mrr_minor) : null, tone: 'success' },
    { label: 'Revenue (30d)', value: data ? formatMoney(data.revenue_30d_minor) : null, change: data?.revenue_change_pct },
    { label: 'Refunds (30d)', value: data ? formatMoney(data.refunds_30d_minor) : null, tone: 'warning' },
  ]

  const queue = [
    { label: 'Open reports', value: data?.open_reports, tone: data?.open_reports ? 'danger' : 'neutral', to: '/admin/reports' },
    { label: 'Pending verification', value: data?.pending_verifications, tone: data?.pending_verifications ? 'warning' : 'neutral', to: '/admin/verifications' },
    { label: 'Suspended users', value: data?.suspended_users, tone: 'neutral', to: '/admin/users?status=suspended' },
    { label: 'Banned users', value: data?.banned_users, tone: 'neutral', to: '/admin/users?status=banned' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="How the platform is doing right now."
        actions={
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data?.as_of ? `Updated ${formatTimeAgo(data.as_of)}` : null}
            {isFetching && !isLoading ? ' · refreshing…' : ''}
          </span>
        }
      />

      <section aria-labelledby="growth-heading">
        <h2 id="growth-heading" className="sr-only">
          Growth
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => <LoadingCard key={index} />)
            : cards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value ?? '—'}
                  change={card.change}
                  hint={card.hint}
                />
              ))}
        </div>
      </section>

      <section aria-labelledby="revenue-heading">
        <h2 id="revenue-heading" className="heading-section mb-3">
          Revenue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => <LoadingCard key={index} />)
            : health.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value ?? '—'}
                  change={card.change}
                  tone={card.tone}
                />
              ))}
        </div>
      </section>

      <section aria-labelledby="queues-heading">
        <h2 id="queues-heading" className="heading-section mb-3">
          Needs attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => <LoadingCard key={index} />)
            : queue.map((card) => (
                <Link
                  key={card.label}
                  to={card.to}
                  className="card block p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-800"
                >
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {card.label}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      card.value
                        ? card.tone === 'danger'
                          ? 'text-red-600 dark:text-red-400'
                          : card.tone === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-300 dark:text-slate-700'
                    }`}
                  >
                    {card.value ?? '—'}
                  </p>
                  <span className="mt-1 inline-block text-xs text-brand-600 dark:text-brand-400">
                    Review →
                  </span>
                </Link>
              ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="heading-section">
            Activity today
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Likes sent</dt>
              <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {data?.likes_today ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Messages sent</dt>
              <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {data?.messages_today ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card p-4">
          <h2 className="heading-section">
            Where to go next
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/admin/analytics" className="text-brand-600 hover:underline dark:text-brand-400">
                Analytics →
              </Link>{' '}
              <span className="text-slate-500 dark:text-slate-400">daily trends and cohorts</span>
            </li>
            <li>
              <Link to="/admin/reports" className="text-brand-600 hover:underline dark:text-brand-400">
                Reports →
              </Link>{' '}
              <span className="text-slate-500 dark:text-slate-400">the moderation queue</span>
            </li>
            <li>
              <Link to="/admin/users" className="text-brand-600 hover:underline dark:text-brand-400">
                Users →
              </Link>{' '}
              <span className="text-slate-500 dark:text-slate-400">search, edit and moderate</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
