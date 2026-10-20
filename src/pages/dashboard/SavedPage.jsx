/**
 * Saved — profiles the member has kept to come back to.
 *
 * ## What this list is, and what it is not
 *
 * A save is private and inert. It does not tell the saved person, it does
 * not enter the match scorer, and it does not change what either party
 * sees anywhere else in the product. That is worth stating in the UI,
 * because "Saved" in a dating app could plausibly mean any of those
 * things, and a user who assumes the other person was notified would be
 * wrong in a way that matters.
 *
 * ## Addressed by profile id, unlike everything else
 *
 * The card carries a **profile UUID**, which is what `/api/profiles/<id>/`
 * and the save endpoints take. Likes and blocks take an integer user id
 * instead, so the two must not be swapped — passing a profile id to a
 * like route is a 404, and passing a user id here is a 400. This page
 * only ever deals in profile ids.
 *
 * ## Unsave is offered in place
 *
 * Removing is the whole point of a saved list — it is how a user prunes
 * it — so it belongs on the card rather than behind the profile page.
 * The mutation invalidates this list rather than patching it, because the
 * server owns the ordering and guessing where a row lands is how a list
 * goes subtly wrong.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ProfileCard } from '../../components/matching/ProfileCard'
import { Pagination } from '../../components/ui/Pagination'
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/States'
import { useSavedProfiles, useToggleSaved } from '../../hooks/useProfile'
import { formatTimeAgo } from '../../utils/format'

function SavedCard({ entry }) {
  const profile = entry.saved_profile
  const toggle = useToggleSaved(profile.id)

  if (!profile) return null

  return (
    <div className="space-y-2">
      <ProfileCard
        profileId={profile.id}
        name={profile.name}
        age={profile.age}
        city={profile.city}
        photo={profile.photo}
        headline={profile.headline}
        isVerified={profile.is_verified}
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Saved {formatTimeAgo(entry.created_at)}
        </span>
        <button
          type="button"
          onClick={() => toggle.mutate({ saved: false })}
          disabled={toggle.isPending}
          className="btn-ghost text-xs disabled:opacity-60"
        >
          {/* Named, because a bare "Remove" beside a photo does not say
              what is being removed from what. */}
          Remove from saved
          <span className="sr-only"> — {profile.name}</span>
        </button>
      </div>
      {toggle.isError ? (
        <p role="alert" className="px-1 text-xs text-red-600 dark:text-red-400">
          Could not remove that. Try again.
        </p>
      ) : null}
    </div>
  )
}

export function SavedPage() {
  const [page, setPage] = useState(1)
  const saved = useSavedProfiles(page)

  const rows = saved.data?.results ?? []

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1 className="heading-display">Saved</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Profiles you have kept to come back to. Only you can see this list, and
          saving someone does not tell them.
        </p>
      </header>

      {saved.isLoading ? (
        <CardGridSkeleton count={4} />
      ) : saved.isError ? (
        <ErrorState error={saved.error} onRetry={saved.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="When you see someone worth a second look, save them from their profile and they will show up here."
          action={
            <Link to="/app/discover" className="btn-primary text-sm">
              Browse discover
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((entry) => (
              <SavedCard key={entry.id} entry={entry} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={saved.data?.totalPages ?? 1}
            count={saved.data?.count}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
