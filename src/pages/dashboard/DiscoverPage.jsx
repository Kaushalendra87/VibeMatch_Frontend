/**
 * Discover — the scored candidate feed.
 *
 * The like flow has one non-obvious rule: **the quota is authoritative
 * from the server, never decremented locally.** A like that returns
 * `quota_exceeded` means the local counter was stale, and guessing would
 * let the UI offer a like the server will refuse.
 *
 * A new match opens a dialog rather than navigating, because the user is
 * mid-scroll and yanking them to another page loses their place.
 *
 * Layout notes: the header is sticky and translucent so the quota stays
 * visible while scrolling a long feed, and the grid gains a fourth column
 * at `xl` — at three columns a 1440px screen leaves a wide dead margin on
 * either side of a max-w-6xl container.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { FeedFilters } from '../../components/matching/FeedFilters'
import { ProfileCard } from '../../components/matching/ProfileCard'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, CardGridSkeleton, ErrorState } from '../../components/ui/States'
import { Pagination } from '../../components/ui/Pagination'
import { Avatar } from '../../components/ui/Avatar'
import { useDiscoveryFeed, useLikeQuota, useSendLike } from '../../hooks/useMatching'
import { useInterests } from '../../hooks/useProfile'
import { useOpenConversation } from '../../hooks/useChat'
import { useNavigate } from 'react-router-dom'

/**
 * A single action button under a card.
 *
 * Round and icon-first, with the label as the accessible name and a
 * tooltip rather than a visible caption. Three labelled rectangles of
 * equal weight under every card made the row of *cards* hard to scan —
 * the eye caught the buttons instead of the faces. The heart carries the
 * one flourish in the app (`heart-pop` on press), because a like is the
 * only action here that is meant to feel good.
 */
function ActionButton({ label, onClick, disabled, tone = 'neutral', animate, children }) {
  const tones = {
    neutral:
      'border border-sand-300 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900 hover:shadow-soft dark:border-sand-700 dark:bg-sand-900 dark:text-slate-400 dark:hover:bg-sand-800',
    primary:
      'bg-brand-600 text-white shadow-soft hover:-translate-y-0.5 hover:bg-brand-700',
    danger:
      'border border-sand-300 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-sand-700 dark:bg-sand-900 dark:hover:border-red-900 dark:hover:bg-red-950/40',
    super:
      'bg-accent-500 text-white shadow-soft hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-lift',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        'inline-flex h-11 flex-1 items-center justify-center rounded-full',
        'transition-all duration-base ease-smooth',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0',
        animate ? 'group-hover:scale-105' : '',
        tones[tone],
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** The three feed actions, shared by the grid so the markup stays flat. */
function FeedActions({ card, onLike, disabled, quotaExhausted, superLikesExhausted }) {
  return (
    <div className="flex gap-2">
      <ActionButton
        label="Pass"
        tone="danger"
        disabled={disabled}
        onClick={() => onLike(card, 'pass')}
      >
        <svg
          className="h-5 w-5 transition-transform duration-base ease-smooth hover:rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </ActionButton>

      <ActionButton
        label="Like"
        tone="primary"
        animate
        disabled={disabled || quotaExhausted}
        onClick={() => onLike(card, 'like')}
      >
        <svg
          className="h-5 w-5 group-hover:animate-heart-pop"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </ActionButton>

      <ActionButton
        label="Super Like"
        tone="super"
        disabled={disabled || superLikesExhausted}
        onClick={() => onLike(card, 'super_like')}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2 9.2 8.6 2 9.2l5.4 4.7L5.8 21 12 17.3 18.2 21l-1.6-7.1L22 9.2l-7.2-.6L12 2Z" />
        </svg>
      </ActionButton>
    </div>
  )
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ ordering: 'score' })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [newMatch, setNewMatch] = useState(null)
  const [actionError, setActionError] = useState(null)

  const feed = useDiscoveryFeed({ ...filters, page })
  const quota = useLikeQuota()
  const interestsQuery = useInterests({ pageSize: 100 })
  const sendLike = useSendLike()
  const openConversation = useOpenConversation()

  const cards = feed.data?.results ?? []
  const interests = interestsQuery.data?.results ?? []

  // A filter change must reset to page 1 — page 3 of the old filter is
  // meaningless against the new one, and the server would happily return
  // an empty page rather than an error.
  const applyFilters = (next) => {
    setFilters(next)
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ ordering: 'score' })
    setPage(1)
  }

  const quotaExhausted = quota.data ? quota.data.likes_remaining === 0 : false
  const superLikesExhausted = quota.data ? quota.data.super_likes_remaining === 0 : false

  const onLike = async (card, kind) => {
    setActionError(null)
    try {
      const result = await sendLike.mutateAsync({ userId: card.user_id, kind })
      if (result.is_new_match && result.match) {
        setNewMatch(result.match)
      }
    } catch (error) {
      // `quota_exceeded` is an expected outcome, not a bug — the counter
      // in the header was simply stale. Show it inline.
      setActionError(error)
    }
  }

  const quotaLabel = useMemo(() => {
    if (!quota.data) return null
    const { likes_limit, likes_remaining } = quota.data
    if (likes_remaining === null) return 'Unlimited likes'
    return `${likes_remaining} of ${likes_limit} likes left today`
  }, [quota.data])

  return (
    <div className="mx-auto max-w-7xl">
      {/* No background mesh. The grid of portraits is the page's visual
          interest, and a drifting wash behind it was competing with the
          one thing on screen worth looking at. The sticky header is the
          only remaining blur, and it earns it by letting cards pass
          beneath without a hard band. */}
      <header className="surface-bar sticky top-0 z-20 -mx-4 mb-5 border-b px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="heading-display">
              Discover
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              People who match what you are looking for.
            </p>
          </div>

          {quotaLabel ? (
            <div
              className={[
                'badge',
                quotaExhausted
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-sand-100 text-slate-600 dark:bg-sand-800 dark:text-slate-400',
              ].join(' ')}
            >
              {quotaLabel}
            </div>
          ) : null}
        </div>

        {/* The filter bar rides inside the sticky header, so narrowing the
            feed never requires scrolling back to the top to do it again. */}
        <FeedFilters
          filters={filters}
          onChange={applyFilters}
          onReset={resetFilters}
          interests={interests}
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen((open) => !open)}
        />
      </header>

      {quotaExhausted ? (
        <div className="alert-warning mb-4">
          You have used all of today&apos;s likes. They reset at midnight — or{' '}
          <Link
            to="/app/subscription"
            className="font-medium underline underline-offset-2"
          >
            upgrade for more
          </Link>
          .
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="alert-error mb-4"
        >
          {actionError.message}
        </div>
      ) : null}

      {feed.isLoading ? (
        <CardGridSkeleton count={6} />
      ) : feed.isError ? (
        <ErrorState error={feed.error} onRetry={feed.refetch} />
      ) : cards.length === 0 ? (
        <EmptyState
          title="No one to show right now"
          description={
            Object.keys(filters).length > 1
              ? 'Try widening your filters, or check back later — new people join every day.'
              : 'Check back later, or widen your match preferences in Settings.'
          }
          action={
            Object.keys(filters).length > 1 ? (
              <button type="button" onClick={resetFilters} className="btn-secondary">
                Clear filters
              </button>
            ) : (
              <Link to="/app/settings" className="btn-secondary">
                Adjust preferences
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <ProfileCard
                key={card.id}
                profileId={card.id}
                name={card.name}
                age={card.age}
                city={card.city}
                photo={card.primary_photo?.url}
                headline={card.headline}
                bio={card.bio}
                isVerified={card.is_verified}
                isOnline={card.is_online}
                matchScore={card.match_score}
                matchReasons={card.match_reasons}
                distanceLabel={card.distance_label}
                interests={card.interests}
                sharedInterests={card.shared_interests}
                actions={
                  <FeedActions
                    card={card}
                    onLike={onLike}
                    disabled={sendLike.isPending}
                    quotaExhausted={quotaExhausted}
                    superLikesExhausted={superLikesExhausted}
                  />
                }
              />
            ))}
          </div>

          <Pagination
            // The page we asked for. `feed.data.page` derives the same
            // number, but this is the value that produced the results, so
            // the highlight cannot disagree with them.
            page={page}
            totalPages={feed.data.totalPages}
            count={feed.data.count}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      )}

      {/* The match celebration. Not a navigation — the user is mid-scroll
          and moving them would lose their place. */}
      <Modal
        isOpen={Boolean(newMatch)}
        onClose={() => setNewMatch(null)}
        title="It's a match!"
        description="You both liked each other."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setNewMatch(null)}
            >
              Keep browsing
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!newMatch) return
                try {
                  const conversation = await openConversation.mutateAsync(
                    newMatch.other_user.id,
                  )
                  navigate(`/app/chat/${conversation.id}`)
                } catch {
                  // The match exists either way; the chat list will show it.
                  navigate('/app/chat')
                }
              }}
            >
              Send a message
            </button>
          </>
        }
      >
        {newMatch?.other_user ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Avatar
              src={newMatch.other_user.photo}
              name={newMatch.other_user.name}
              size="xl"
            />
            <p className="heading-section">
              You and {newMatch.other_user.name} liked each other
            </p>
            {newMatch.match_score != null ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {newMatch.match_score}% match
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
