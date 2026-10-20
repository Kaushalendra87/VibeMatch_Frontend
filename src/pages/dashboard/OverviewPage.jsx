/**
 * Overview — the dashboard home.
 *
 * Every number here comes from a different endpoint, so the page is a set
 * of independent queries rather than one aggregate. That is deliberate: a
 * slow stats query must not blank the whole page, and each card renders
 * its own loading and error state.
 *
 * The profile-completion card is the one piece of nudging on the page —
 * an incomplete profile is scored lower and shown less, so the percentage
 * links straight to the section that would raise it.
 */

import { Link } from 'react-router-dom'

import { Avatar } from '../../components/ui/Avatar'
import { Badge, VerifiedBadge } from '../../components/ui/Badge'
import { EmptyState, RowListSkeleton, Skeleton } from '../../components/ui/States'
import { useAuth } from '../../context/AuthContext'
import { useMatches } from '../../hooks/useMatching'
import { useMyStats, useMyViewers } from '../../hooks/useProfile'
import { useConversations, useUnreadCount } from '../../hooks/useChat'
import { formatRelative, formatTimeAgo } from '../../utils/format'

/** One headline number. */
function StatCard({ label, value, hint, icon, to, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-slate-600 dark:text-slate-400',
    brand: 'text-brand-600 dark:text-brand-400',
    success: 'text-sage-600 dark:text-sage-400',
    info: 'text-sky-600 dark:text-sky-400',
  }

  const body = (
    <div className="card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={tones[tone]} aria-hidden="true">
          {icon}
        </span>
      </div>
      {value == null ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
          {value}
        </p>
      )}
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  )

  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

/** A progress bar with an accessible value. */
function CompletionCard({ percentage, isVerified }) {
  // The server computes this; the client only displays it. Which
  // sections are missing is inferred from the profile elsewhere — this
  // card just shows the score and links to the editor.
  const tone =
    percentage >= 80 ? 'bg-sage-500' : percentage >= 50 ? 'bg-brand-500' : 'bg-amber-500'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Profile strength
        </p>
        {isVerified ? <VerifiedBadge /> : null}
      </div>

      <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
        {percentage}%
      </p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {percentage >= 100
          ? 'Your profile is complete.'
          : 'A fuller profile is shown to more people and scores higher.'}
      </p>

      {percentage < 100 ? (
        <Link to="/app/profile" className="btn-secondary mt-3 w-full text-sm">
          Complete your profile
        </Link>
      ) : null}
    </div>
  )
}

export function OverviewPage() {
  const { user } = useAuth()
  const stats = useMyStats()
  const matches = useMatches(1)
  const conversations = useConversations()
  const viewers = useMyViewers(1)
  const unread = useUnreadCount()

  const firstName = user?.first_name || 'there'
  const recentMatches = (matches.data?.results ?? []).slice(0, 4)
  const recentConversations = (conversations.data?.results ?? []).slice(0, 5)
  const recentViewers = (viewers.data?.results ?? []).slice(0, 4)

  return (
    <div className="mx-auto max-w-wide">
      <header className="mb-6">
        <h1 className="heading-display">
          Hey {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {unread.data
            ? `You have ${unread.data} unread ${unread.data === 1 ? 'message' : 'messages'}.`
            : 'Here is what is happening with your matches.'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompletionCard
          percentage={user?.profile_completion ?? 0}
          isVerified={user?.is_verified}
        />

        <StatCard
          label="New matches"
          value={matches.data?.count ?? null}
          hint="People who liked you back"
          to="/app/matches"
          tone="brand"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 20.5 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13L12 20.5Z"
              />
            </svg>
          }
        />

        <StatCard
          label="Unread messages"
          value={unread.data ?? null}
          hint="Across all conversations"
          to="/app/chat"
          tone="info"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z"
              />
            </svg>
          }
        />

        <StatCard
          label="Profile views"
          value={stats.data?.profile_views ?? null}
          hint={
            stats.data?.profile_views_7d != null
              ? `${stats.data.profile_views_7d} in the last 7 days`
              : undefined
          }
          to="/app/settings"
          tone="success"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Recent matches ─────────────────────────────────────── */}
        <section aria-labelledby="recent-matches-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2
              id="recent-matches-heading"
              className="heading-section"
            >
              Recent matches
            </h2>
            <Link
              to="/app/matches"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              View all
            </Link>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {matches.isLoading ? (
              <RowListSkeleton count={3} />
            ) : recentMatches.length === 0 ? (
              <EmptyState
                title="No matches yet"
                description="Like people in Discover — when they like you back, they appear here."
                action={
                  <Link to="/app/discover" className="btn-primary">
                    Start discovering
                  </Link>
                }
              />
            ) : (
              recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/app/matches/${match.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Avatar
                    src={match.other_user?.photo}
                    name={match.other_user?.name}
                    size="md"
                    isOnline={match.other_user?.is_online}
                    showOnlineDot
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {match.other_user?.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Matched {formatTimeAgo(match.matched_at)}
                    </p>
                  </div>
                  {match.match_score != null ? (
                    <Badge tone="brand">{match.match_score}%</Badge>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ── Recent conversations ───────────────────────────────── */}
        <section aria-labelledby="recent-chats-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2
              id="recent-chats-heading"
              className="heading-section"
            >
              Recent activity
            </h2>
            <Link
              to="/app/chat"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Open chat
            </Link>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {conversations.isLoading ? (
              <RowListSkeleton count={3} />
            ) : recentConversations.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                description="Once you match with someone, you can start chatting."
              />
            ) : (
              recentConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={`/app/chat/${conversation.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Avatar
                    src={conversation.other_user?.photo}
                    name={conversation.other_user?.name}
                    size="md"
                    isOnline={conversation.other_user?.is_online}
                    showOnlineDot
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {conversation.other_user?.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {conversation.last_message_preview || 'No messages yet'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatRelative(conversation.last_message_at)}
                    </span>
                    {conversation.unread_count > 0 ? (
                      <span className="badge bg-brand-600 text-white">
                        {conversation.unread_count}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Who viewed you ───────────────────────────────────────── */}
      {recentViewers.length > 0 ? (
        <section aria-labelledby="viewers-heading" className="mt-6">
          <h2
            id="viewers-heading"
            className="heading-section mb-3"
          >
            Recently viewed you
          </h2>
          <div className="flex flex-wrap gap-3">
            {recentViewers.map((viewer) => (
              <Link
                key={viewer.id}
                to={`/app/profile/${viewer.id}`}
                className="card flex w-32 flex-col items-center gap-2 p-3 transition-shadow hover:shadow-md"
              >
                <Avatar
                  src={viewer.primary_photo?.url}
                  name={viewer.name}
                  size="lg"
                />
                <p className="w-full truncate text-center text-sm font-medium text-slate-900 dark:text-slate-100">
                  {viewer.name}
                </p>
                <p className="w-full truncate text-center text-xs text-slate-500 dark:text-slate-400">
                  {viewer.age ? `${viewer.age} · ` : ''}
                  {viewer.city}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
