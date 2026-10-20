/**
 * Subscription.
 *
 * The billing app has real models — `Plan`, `Subscription` and `Payment`,
 * with per-plan limits that the matching engine already reads — but no
 * endpoints: `billing/urls.py` is still `urlpatterns = []`. So there is no
 * plan list to fetch and no checkout to open.
 *
 * What *does* work is the quota. `/api/matches/likes/quota/` is live, and
 * it is the honest answer to "what does my plan actually give me right
 * now" — so this page shows the real allowance the user has today, and
 * explains what is missing rather than showing prices it cannot charge.
 */

import { Link } from 'react-router-dom'

import { ComingSoon } from '../../components/ui/ComingSoon'
import { Badge } from '../../components/ui/Badge'
import { ErrorState, Skeleton } from '../../components/ui/States'
import { useLikeQuota } from '../../hooks/useMatching'
import { useAuth } from '../../context/AuthContext'

function QuotaCard() {
  const quota = useLikeQuota()

  if (quota.isError) return <ErrorState error={quota.error} onRetry={quota.refetch} />

  const row = (label, used, limit, remaining) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      {quota.isLoading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {/* A null remaining means unlimited — the server's own signal,
              not a number to interpret. */}
          {remaining === null ? 'Unlimited' : `${remaining} left of ${limit}`}
          {remaining !== null ? (
            <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
              ({used} used)
            </span>
          ) : null}
        </span>
      )}
    </div>
  )

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="heading-section">
          Today&apos;s allowance
        </h2>
        {quota.data ? (
          <Badge tone={quota.data.likes_remaining === 0 ? 'warning' : 'neutral'}>
            Resets daily
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {row(
          'Likes',
          quota.data?.likes_used,
          quota.data?.likes_limit,
          quota.data?.likes_remaining,
        )}
        {row(
          'Super likes',
          quota.data?.super_likes_used,
          quota.data?.super_likes_limit,
          quota.data?.super_likes_remaining,
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        This is what your current plan grants you. It resets at local midnight.
      </p>
    </div>
  )
}

export function SubscriptionPage() {
  const { hasActiveSubscription, planName } = useAuth()

  return (
    <div className="mx-auto max-w-narrow space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-display">
            Subscription
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Your plan, your limits, and your payment history.
          </p>
        </div>
        <Badge tone={hasActiveSubscription ? 'success' : 'neutral'}>
          {hasActiveSubscription ? (planName ?? 'Subscribed') : 'Free plan'}
        </Badge>
      </header>

      <QuotaCard />

      <ComingSoon
        title="Plans and checkout are not available yet"
        description="The billing API has not been built. The plan and payment tables exist and the matching engine already honours their limits, but there is no endpoint to list plans or take a payment — so nothing here can be bought yet."
        items={[
          'Plan comparison with prices and feature lists',
          'Checkout and payment method management',
          'Payment history and receipts',
          'Upgrading, downgrading and cancelling',
        ]}
        action={
          <Link to="/app/discover" className="btn-secondary">
            Back to discover
          </Link>
        }
      />

      {/* The one thing a free user can act on today. */}
      {!hasActiveSubscription ? (
        <div className="card p-5">
          <h2 className="heading-section">
            What a paid plan will unlock
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>See everyone who liked you, not just the count.</li>
            <li>More likes and super likes each day.</li>
            <li>Rewind a pass and bring someone back to your feed.</li>
            <li>Incognito browsing and priority placement in the feed.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            These limits are defined on the `Plan` model and are already applied
            by the scorer — they simply cannot be purchased until the billing
            endpoints exist.
          </p>
        </div>
      ) : null}
    </div>
  )
}
