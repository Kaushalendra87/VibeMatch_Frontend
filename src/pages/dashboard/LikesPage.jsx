/**
 * Likes — who liked you, who you liked, and the mutual pairs.
 *
 * The four tabs are four different questions against the same table, and
 * the payload reflects that: a like row carries **both** `from_user` and
 * `to_user`. Which one is "the other person" depends entirely on the tab —
 * on `received` the actor is `from_user`, on `liked` it is `to_user`. This
 * page does that normalisation once, in `cardFor`, rather than letting
 * three different renderers each decide.
 *
 * `received` is also the tab a free plan withholds: the count comes back
 * but the rows do not. That is why an empty `received` list renders an
 * upgrade prompt rather than the generic "no likes yet" — the two look
 * identical in the payload and mean opposite things.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ProfileCard } from '../../components/matching/ProfileCard'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { EmptyState, CardGridSkeleton, QueryState } from '../../components/ui/States'
import { Pagination } from '../../components/ui/Pagination'
import { useLikes, useSendLike } from '../../hooks/useMatching'
import { useAuth } from '../../context/AuthContext'
import { LIKE_TABS } from '../../utils/constants'
import { formatTimeAgo } from '../../utils/format'

/** The person on the other end of a like row, given the tab's perspective. */
function cardFor(like, tab) {
  // On `liked` and `passed` the current user is the actor, so the person
  // to show is the one they acted on. Everywhere else it is the actor.
  const other = tab === 'liked' || tab === 'passed' ? like.to_user : like.from_user
  if (!other) return null
  return {
    // `id` is the integer User pk (what likes take); `profile_id` is the
    // UUID (what the profile page takes). Swapping them is a 404.
    userId: other.id,
    profileId: other.profile_id,
    name: other.name,
    age: other.age,
    city: other.city,
    photo: other.photo,
  }
}

function LikeGrid({ likes, tab, emptyState, onLikeBack, isLiking }) {
  if (likes.length === 0) return emptyState

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {likes.map((like) => {
        const card = cardFor(like, tab)
        if (!card) return null

        return (
          <ProfileCard
            key={like.id}
            profileId={card.profileId}
            name={card.name}
            age={card.age}
            city={card.city}
            photo={card.photo}
            // The score is a snapshot taken when the like happened, not
            // the live score — the two drift as profiles change. Labelled
            // as such so it does not read as a stale bug.
            //
            // **Scaled here, and it has to be.** `score_at_like` is
            // `Breakdown.total`, a 0-1 float; the feed's `match_score` is
            // `Breakdown.percent`, a 0-100 int. Same idea, different unit,
            // and `ScoreBadge` appends its own `%` — so passing the raw
            // float renders "1% match" on an 87% pair.
            matchScore={
              like.score_at_like != null
                ? Math.round(like.score_at_like * 100)
                : undefined
            }
            cornerLabel={
              like.is_match
                ? 'Matched'
                : like.kind === 'super_like'
                  ? 'Super like'
                  : tab === 'received'
                    ? 'Likes you'
                    : undefined
            }
            actions={
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {formatTimeAgo(like.created_at)}
                </span>

                {/* Liking back only makes sense on the tab where someone
                    else is the actor — on `liked` and `passed` the verdict
                    is already this user's own. */}
                {tab === 'received' && !like.is_match ? (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={isLiking}
                    onClick={() => onLikeBack(card.userId)}
                  >
                    Like back
                  </button>
                ) : card.profileId ? (
                  <Link
                    to={`/app/profile/${card.profileId}`}
                    className="btn-secondary text-sm"
                  >
                    View profile
                  </Link>
                ) : null}
              </div>
            }
          />
        )
      })}
    </div>
  )
}

export function LikesPage() {
  const { hasActiveSubscription } = useAuth()
  const [tab, setTab] = useState('received')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState(null)

  const likes = useLikes(tab, page)
  const sendLike = useSendLike()

  const rows = likes.data?.results ?? []

  // Switching tabs must reset the page — page 3 of `received` is a
  // different set of rows than page 3 of `liked`, and the server would
  // happily return an empty page rather than an error.
  const changeTab = (next) => {
    setTab(next)
    setPage(1)
  }

  const onLikeBack = async (userId) => {
    setNotice(null)
    try {
      const result = await sendLike.mutateAsync({ userId, kind: 'like' })
      if (result.is_new_match) {
        // A dialog would be wrong here — the user is scanning a grid, not
        // swiping. A banner plus a link is enough to say what happened.
        setNotice({
          tone: 'success',
          message: `It's a match with ${result.match?.other_user?.name ?? 'them'}!`,
          matchId: result.match?.id,
        })
      }
    } catch (error) {
      setNotice({ tone: 'error', message: error.message })
    }
  }

  const emptyFor = (activeTab) => {
    if (activeTab === 'received') {
      // A free plan gets the count but not the people. An empty list here
      // is ambiguous, so say which case this is rather than assuming.
      if (!hasActiveSubscription) {
        return (
          <EmptyState
            title="See who likes you"
            description="Your plan shows the number of likes you have received but not who sent them. Upgrade to see everyone and like them back instantly."
            action={
              <Link to="/app/subscription" className="btn-primary">
                View plans
              </Link>
            }
          />
        )
      }
      return (
        <EmptyState
          title="No likes yet"
          description="When someone likes your profile, they will appear here."
          action={
            <Link to="/app/discover" className="btn-primary">
              Start discovering
            </Link>
          }
        />
      )
    }

    if (activeTab === 'mutual') {
      return (
        <EmptyState
          title="No mutual likes yet"
          description="A mutual like becomes a match — you will find those under Matches."
          action={
            <Link to="/app/matches" className="btn-secondary">
              Go to matches
            </Link>
          }
        />
      )
    }

    return (
      <EmptyState
        title={activeTab === 'passed' ? 'Nobody passed' : 'You have not liked anyone yet'}
        description={
          activeTab === 'passed'
            ? 'People you pass on are hidden from your feed. You can undo a pass to bring them back.'
            : 'Likes you send from Discover show up here.'
        }
        action={
          <Link to="/app/discover" className="btn-primary">
            Start discovering
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-wide">
      <header className="mb-4">
        <h1 className="heading-display">Likes</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Everyone who liked you, and everyone you liked.
        </p>
      </header>

      <Tabs
        tabs={LIKE_TABS.map((entry) => ({
          value: entry.value,
          label: entry.label,
          // The count only belongs to the active tab's payload, so it is
          // only shown for that one rather than faked for the others.
          count: entry.value === tab ? likes.data?.count : undefined,
        }))}
        value={tab}
        onChange={changeTab}
        ariaLabel="Like lists"
      />

      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={[
            'alert mt-4 flex flex-wrap items-center gap-3',
            notice.tone === 'error'
              ? 'alert-error'
              : 'alert-success',
          ].join(' ')}
        >
          <span>{notice.message}</span>
          {notice.matchId ? (
            <Link
              to={`/app/matches/${notice.matchId}`}
              className="font-medium underline underline-offset-2"
            >
              View match
            </Link>
          ) : null}
        </div>
      ) : null}

      <TabPanel tabValue={tab} value={tab} className="mt-5">
        {/* No `isEmpty` here: an empty tab is not a bare empty state, it is
            a tab-specific message that `LikeGrid` renders from
            `emptyFor(tab)`. This ladder only has to cover loading and
            failure. */}
        <QueryState
          isLoading={likes.isLoading}
          isError={likes.isError}
          error={likes.error}
          onRetry={likes.refetch}
          skeleton={<CardGridSkeleton count={6} />}
        >
          <>
            <LikeGrid
              likes={rows}
              tab={tab}
              emptyState={emptyFor(tab)}
              onLikeBack={onLikeBack}
              isLiking={sendLike.isPending}
            />

            <Pagination
              // The page we asked for, so the highlight cannot disagree
              // with the rows it produced.
              page={page}
              totalPages={likes.data?.totalPages ?? 1}
              count={likes.data?.count}
              onPageChange={setPage}
              className="mt-6"
            />
          </>
        </QueryState>
      </TabPanel>
    </div>
  )
}
