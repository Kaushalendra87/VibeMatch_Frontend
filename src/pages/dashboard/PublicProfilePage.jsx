/**
 * Someone else's profile, reached from a card, a like or a match.
 *
 * Addressed by **profile UUID**, not user id — that is what the card
 * carries and what `/api/profiles/<uuid>/` takes.
 *
 * ## Why the only actions here are report and block
 *
 * Liking and messaging both address a **user id**, and
 * `PublicProfileSerializer` does not carry one — deliberately, since the
 * whole point of this route is that a profile is reachable without
 * exposing the account behind it. So the actions offered are the ones
 * that work from a profile id alone: report and block, which are reached
 * through the safety centre.
 *
 * The temptation is to render a like button and pass it the profile id.
 * That would 404 on the server, or worse, silently succeed against the
 * wrong record. Liking stays in the feed and on the match page, where the
 * user id is genuinely available.
 *
 * The moderation endpoints themselves live in the moderation app, which
 * is still a stub with `urlpatterns = []`. Rather than render buttons that
 * 404, the safety actions link to the safety centre, which explains the
 * situation honestly.
 */

import { Link, useParams } from 'react-router-dom'

import { ProfileDetail } from '../../components/profiles/ProfileDetail'
import { SaveButton } from '../../components/profiles/SaveButton'
import { ErrorState } from '../../components/ui/States'
import { LoadingState } from '../../components/ui/Spinner'
import { usePublicProfile } from '../../hooks/useProfile'

export function PublicProfilePage() {
  const { profileId } = useParams()
  const profile = usePublicProfile(profileId)

  if (profile.isLoading) return <LoadingState message="Loading profile…" />
  if (profile.isError) {
    return (
      <div className="mx-auto max-w-content">
        <ErrorState error={profile.error} onRetry={profile.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-content">
      {/*
        A back link and the safety actions sit above the profile rather
        than inside it. `ProfileDetail` is the profile *body* — the match
        page renders the same component with a match banner above it, so
        anything placed inside would appear in both places.
      */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/discover"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
          Back to discover
        </Link>

        <div className="flex items-center gap-2">
          {/*
            Hidden on your own profile. The owner reaches this page via
            "Preview as others see you", and saving yourself is a 400
            server-side — so the button is not offered rather than left
            there to fail. The server states this as `is_own_profile`
            because the public payload carries no user id to compare.
          */}
          {profile.data?.is_own_profile ? null : (
            <SaveButton
              profileId={profile.data.id}
              isSaved={Boolean(profile.data.is_saved)}
            />
          )}
          <Link to="/app/safety" className="btn-ghost text-sm">
            Report or block
          </Link>
        </div>
      </div>

      <ProfileDetail profile={profile.data} />
    </div>
  )
}
