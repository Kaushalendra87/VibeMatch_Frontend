/**
 * Matches — everyone who liked back.
 *
 * A match row carries `other_user` already resolved from the requesting
 * user's perspective (the server does the pair-ordering flip), so unlike
 * the likes tabs there is no normalisation to do here.
 *
 * Unmatching is destructive but *reversible in principle and not in
 * practice* — the row survives as `unmatched`, but re-matching requires
 * both people to like again. It gets a confirmation dialog for that
 * reason, and the dialog names the person rather than saying "this match".
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { QueryState, RowListSkeleton } from '../../components/ui/States'
import { Pagination } from '../../components/ui/Pagination'
import { useMatches, useUnmatch } from '../../hooks/useMatching'
import { useOpenConversation } from '../../hooks/useChat'
import { formatTimeAgo } from '../../utils/format'

function MatchRow({ match, onUnmatch, onMessage, isBusy }) {
  const other = match.other_user

  return (
    <div className="card flex items-center gap-4 p-4">
      <Link
        to={other?.profile_id ? `/app/profile/${other.profile_id}` : '#'}
        className="shrink-0"
      >
        <Avatar
          src={other?.photo}
          name={other?.name}
          size="lg"
          isOnline={other?.is_online}
          showOnlineDot
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={other?.profile_id ? `/app/profile/${other.profile_id}` : '#'}
            className="truncate font-display text-base font-semibold text-slate-900 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
          >
            {other?.name ?? 'Unknown'}
          </Link>
          {other?.is_online ? (
            <span className="sr-only">Online now</span>
          ) : null}
        </div>

        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
          {other?.age ? `${other.age} · ` : ''}
          {other?.city}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {match.match_score != null ? (
            <Badge tone="brand">{match.match_score}% match</Badge>
          ) : null}
          {match.is_super_like ? <Badge tone="info">Super like</Badge> : null}
          {match.message_count > 0 ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {match.message_count}{' '}
              {match.message_count === 1 ? 'message' : 'messages'}
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              No messages yet
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {match.matched_at ? `Matched ${formatTimeAgo(match.matched_at)}` : ''}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={isBusy}
            onClick={() => onMessage(match)}
          >
            Message
          </button>
          <Link to={`/app/matches/${match.id}`} className="btn-secondary text-sm">
            View
          </Link>
          <button
            type="button"
            className="btn-danger-ghost"
            disabled={isBusy}
            onClick={() => onUnmatch(match)}
          >
            Unmatch
          </button>
        </div>
      </div>
    </div>
  )
}

export function MatchesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pendingUnmatch, setPendingUnmatch] = useState(null)
  const [notice, setNotice] = useState(null)

  const matches = useMatches(page)
  const unmatch = useUnmatch()
  const openConversation = useOpenConversation()

  const rows = matches.data?.results ?? []

  const onMessage = async (match) => {
    setNotice(null)
    try {
      const conversation = await openConversation.mutateAsync(match.other_user.id)
      navigate(`/app/chat/${conversation.id}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const confirmUnmatch = async () => {
    if (!pendingUnmatch) return
    try {
      await unmatch.mutateAsync(pendingUnmatch.id)
      setPendingUnmatch(null)
    } catch (error) {
      setPendingUnmatch(null)
      setNotice(error.message)
    }
  }

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading-display">
            Matches
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            People you and they both liked.
          </p>
        </div>
        {matches.data?.count ? (
          <Badge tone="brand">
            {matches.data.count} {matches.data.count === 1 ? 'match' : 'matches'}
          </Badge>
        ) : null}
      </header>

      {notice ? (
        <div
          role="alert"
          className="alert-error mb-4"
        >
          {notice}
        </div>
      ) : null}

      {/* One ladder, via the shared `QueryState` rather than a hand-written
          ternary chain. The order is fixed there — loading, then error,
          then empty — which matters: an error that also has no rows must
          report the error, not "nothing here". */}
      <QueryState
        isLoading={matches.isLoading}
        isError={matches.isError}
        error={matches.error}
        onRetry={matches.refetch}
        skeleton={<RowListSkeleton count={5} />}
        isEmpty={rows.length === 0}
        emptyTitle="No matches yet"
        emptyDescription="When someone you liked likes you back, they show up here and you can start chatting."
        emptyAction={
          <Link to="/app/discover" className="btn-primary">
            Start discovering
          </Link>
        }
      >
        <>
          <div className="space-y-3">
            {rows.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                onUnmatch={setPendingUnmatch}
                onMessage={onMessage}
                isBusy={unmatch.isPending || openConversation.isPending}
              />
            ))}
          </div>

          <Pagination
            // The page we asked for, so the highlight cannot disagree
            // with the rows it produced.
            page={page}
            totalPages={matches.data?.totalPages ?? 1}
            count={matches.data?.count ?? 0}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      </QueryState>

      <ConfirmDialog
        isOpen={Boolean(pendingUnmatch)}
        onClose={() => setPendingUnmatch(null)}
        onConfirm={confirmUnmatch}
        title={`Unmatch ${pendingUnmatch?.other_user?.name ?? 'this person'}?`}
        description="Your conversation will be closed and they will no longer appear in your matches. They are not told that you unmatched."
        confirmLabel="Unmatch"
        isDestructive
        isPending={unmatch.isPending}
      />
    </div>
  )
}
