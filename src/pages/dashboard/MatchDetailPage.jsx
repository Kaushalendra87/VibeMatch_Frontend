/**
 * One match, in full.
 *
 * `MatchDetailSerializer` nests the counterpart's `PublicProfileSerializer`
 * under `profile`, so this page can render everything the public profile
 * page shows without a second request — and with the same field names.
 * That is why the shared `<ProfileDetail>` component is used here and on
 * the public profile route rather than two near-identical layouts.
 *
 * The score breakdown is the one thing unique to this page: a match is
 * the moment the number stops being an abstraction, so this is where it
 * is worth showing *why* the two of them scored what they did.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'

import { ProfileDetail } from '../../components/profiles/ProfileDetail'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { ErrorState } from '../../components/ui/States'
import { LoadingState } from '../../components/ui/Spinner'
import { useMatch, useUnmatch } from '../../hooks/useMatching'
import { useOpenConversation } from '../../hooks/useChat'
import { useState } from 'react'

export function MatchDetailPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [notice, setNotice] = useState(null)

  const match = useMatch(matchId)
  const unmatch = useUnmatch()
  const openConversation = useOpenConversation()

  if (match.isLoading) return <LoadingState message="Loading match…" />
  if (match.isError) {
    return <ErrorState error={match.error} onRetry={match.refetch} />
  }

  const data = match.data
  const other = data?.other_user
  const profile = data?.profile

  const onMessage = async () => {
    setNotice(null)
    try {
      const conversation = await openConversation.mutateAsync(other.id)
      navigate(`/app/chat/${conversation.id}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const confirmUnmatch = async () => {
    try {
      await unmatch.mutateAsync(data.id)
      navigate('/app/matches', { replace: true })
    } catch (error) {
      setIsConfirmOpen(false)
      setNotice(error.message)
    }
  }

  return (
    <div className="mx-auto max-w-content">
      <Link
        to="/app/matches"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
        </svg>
        All matches
      </Link>

      {notice ? (
        <div
          role="alert"
          className="alert-error mb-4"
        >
          {notice}
        </div>
      ) : null}

      {/* The match banner sits above the profile: this page is reachable
          from a match list, and the relationship context (score, when,
          super-like) is what distinguishes it from a plain profile view. */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">Matched</Badge>
          {data.match_score != null ? (
            <Badge tone="brand">{data.match_score}% match</Badge>
          ) : null}
          {data.is_super_like ? <Badge tone="info">Super like</Badge> : null}
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {data.message_count > 0
              ? `${data.message_count} ${data.message_count === 1 ? 'message' : 'messages'}`
              : 'No messages yet — say hello'}
          </span>
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={onMessage}>
            Message
          </button>
          <button
            type="button"
            className="btn-danger-ghost"
            onClick={() => setIsConfirmOpen(true)}
          >
            Unmatch
          </button>
        </div>
      </div>

      {profile ? (
        <ProfileDetail profile={profile} />
      ) : (
        // The counterpart deleted or deactivated their profile. The match
        // row survives, so this is a real state rather than an error.
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {other?.name ?? 'This person'}&apos;s profile is no longer available.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmUnmatch}
        title={`Unmatch ${other?.name ?? 'this person'}?`}
        description="Your conversation will be closed and they will no longer appear in your matches. They are not told that you unmatched."
        confirmLabel="Unmatch"
        isDestructive
        isPending={unmatch.isPending}
      />
    </div>
  )
}
