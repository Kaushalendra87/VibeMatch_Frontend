/**
 * A person, as a card.
 *
 * One component serves the discovery feed, the likes tabs and the matches
 * list. Those three payloads are shaped differently — the feed has the
 * full `FeedProfileSerializer` with score breakdown, the likes tabs have
 * a `UserCardSerializer` with a `from_user`/`to_user` pair, matches have
 * an `other_user` — so the callers normalise to the props below rather
 * than this component guessing which shape it was handed.
 *
 * This component only ever navigates, so it takes the **profile UUID**
 * and nothing else. The integer user id — which is what the like
 * endpoints take — is deliberately not a prop here: the callers keep it
 * and use it for their own action handlers, because a card that took both
 * ids would invite passing the wrong one to the wrong place, and that is
 * a 404 which reads like a permissions failure.
 *
 * **The visual hierarchy is photo → identity → why → act**, in that
 * order, and the markup follows it. The only things over the photo are
 * the name and two small chips, and the chips are translucent rather
 * than opaque so the photo stays the largest uninterrupted surface on
 * the card. Nothing else is allowed on top of it — a card whose job is
 * to show a face should not be wearing furniture.
 */

import { Link } from 'react-router-dom'

import { Avatar } from '../ui/Avatar'
import { ScoreBadge, VerifiedBadge } from '../ui/Badge'
import { truncate } from '../../utils/format'

/** A small chip for one shared interest. */
function InterestChip({ interest, shared = false }) {
  return (
    <span
      className={[
        'badge',
        shared
          ? 'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-900'
          : 'bg-sand-100 text-slate-600 dark:bg-sand-800 dark:text-slate-400',
      ].join(' ')}
    >
      {shared ? (
        <svg
          className="mr-1 h-3 w-3"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : null}
      {interest.name}
    </span>
  )
}

export function ProfileCard({
  profileId,
  name,
  age,
  city,
  photo,
  headline,
  bio,
  isVerified = false,
  isOnline = false,
  matchScore,
  matchReasons = [],
  distanceLabel,
  interests = [],
  sharedInterests = [],
  /** The action row — Like/Pass/Super Like, or a message button. */
  actions,
  /** Rendered over the photo, e.g. a "Liked you" ribbon. */
  cornerLabel,
  className = '',
}) {
  // Shared interests are rendered first and distinctly: they are the
  // reason the card is in the feed at all.
  const sharedIds = new Set(sharedInterests.map((item) => item.id))
  const otherInterests = interests.filter((item) => !sharedIds.has(item.id))
  const totalInterests = sharedInterests.length + otherInterests.length
  const profileHref = profileId ? `/app/profile/${profileId}` : '#'

  return (
    <article
      className={`card-interactive group flex flex-col overflow-hidden ${className}`}
    >
      <div className="relative overflow-hidden">
        <Link to={profileHref} className="block" aria-label={`View ${name}'s profile`}>
          {photo ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-80 w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-[1.06]"
            />
          ) : (
            // No photo is a real state — a new profile may not have one
            // approved yet — and a blank space reads as a broken image.
            <div className="flex h-80 w-full items-center justify-center bg-gradient-to-br from-sand-100 to-sand-200 dark:from-sand-800 dark:to-sand-900">
              <Avatar name={name} size="2xl" />
            </div>
          )}

          {/* The scrim is what lets the name sit on the photo. A gradient
              rather than a band, so a light photo still reads and the
              transition never shows an edge. */}
          <div
            className="scrim pointer-events-none absolute inset-x-0 bottom-0 h-32"
            aria-hidden="true"
          />
        </Link>

        {matchScore != null ? (
          <div className="absolute left-3 top-3">
            {/* Sage at the top of the range, rose in the middle, amber
                below — the one colour cue on the card that carries a
                number, and the number is always rendered too. */}
            <ScoreBadge score={matchScore} className="shadow-lift backdrop-blur-sm" />
          </div>
        ) : null}

        {cornerLabel ? (
          <div className="absolute right-3 top-3">
            <span className="badge chip-on-photo text-white">{cornerLabel}</span>
          </div>
        ) : null}

        {/* Name over the photo, where the eye already is, so the identity
            does not require a second saccade past the image. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-end justify-between gap-2">
            <h3 className="min-w-0 font-display text-lg font-semibold tracking-tight text-white drop-shadow-sm">
              <Link to={profileHref} className="pointer-events-auto hover:underline">
                {name}
                {age ? <span className="font-normal text-white/80">, {age}</span> : null}
              </Link>
            </h3>

            <span className="badge chip-on-photo shrink-0 gap-1.5 text-white">
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  isOnline ? 'animate-pulse bg-sage-400' : 'bg-slate-300/70',
                ].join(' ')}
                aria-hidden="true"
              />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {city || distanceLabel ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/85">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
                />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {city}
              {/* Only ever the approximate bucket, never an exact distance —
                  the server sends a label like "within 5 km" for this
                  reason. */}
              {distanceLabel ? <span>· {distanceLabel}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {headline ? (
          <p className="flex items-start gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
            {isVerified ? <VerifiedBadge className="mt-0.5 shrink-0" /> : null}
            <span className="min-w-0">{truncate(headline, 80)}</span>
          </p>
        ) : isVerified ? (
          <VerifiedBadge showLabel className="text-sm" />
        ) : null}

        {bio ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {truncate(bio, 110)}
          </p>
        ) : null}

        {matchReasons.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {matchReasons.slice(0, 2).map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-1.5 text-xs text-brand-600 dark:text-brand-400"
              >
                <svg
                  className="mt-0.5 h-3 w-3 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2 9.2 8.6 2 9.2l5.4 4.7L5.8 21 12 17.3 18.2 21l-1.6-7.1L22 9.2l-7.2-.6L12 2Z" />
                </svg>
                <span className="min-w-0">{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {totalInterests > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sharedInterests.slice(0, 3).map((interest) => (
              <InterestChip key={interest.id} interest={interest} shared />
            ))}
            {otherInterests.slice(0, 3).map((interest) => (
              <InterestChip key={interest.id} interest={interest} />
            ))}
            {totalInterests > 6 ? (
              <span className="badge bg-sand-100 text-slate-500 dark:bg-sand-800 dark:text-slate-400">
                +{totalInterests - 6}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* `mt-auto` pins the actions to the bottom so cards in a row line
            up even when their bios differ in length. The divider is what
            separates "who this is" from "what you can do about it" when
            the card is tall. */}
        {actions ? (
          <div className="mt-auto border-t border-sand-100 pt-3 dark:border-sand-800">
            <div className="pt-1">{actions}</div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
