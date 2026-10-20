/**
 * The save/unsave toggle for another member's profile.
 *
 * ## Why this is a toggle and not a link to the Saved page
 *
 * Saving is the one action on a profile that is entirely about the viewer
 * and has no effect on the person being viewed — they are never told, and
 * nothing about their experience changes. That makes it safe to do
 * in-place, and it means the button has to say which state it is *in*,
 * not just what it does. A button labelled only "Save" leaves a user who
 * already saved wondering whether their first tap registered.
 *
 * ## Accessibility
 *
 * `aria-pressed` is what makes it a toggle to a screen reader rather than
 * a button that keeps saying "Save" after it has saved. The label is the
 * action ("Save profile" / "Saved"), and the state is carried by
 * `aria-pressed` — putting the state in the label as well ("Saved" vs
 * "Save") is the pattern that reads as two different buttons.
 *
 * The icon is decorative: `aria-hidden`, because the label already says
 * everything it would.
 */

import { useToggleSaved } from '../../hooks/useProfile'

function BookmarkIcon({ filled }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4.5h12a1 1 0 0 1 1 1v14l-7-4-7 4v-14a1 1 0 0 1 1-1Z"
      />
    </svg>
  )
}

export function SaveButton({ profileId, isSaved = false, className = '' }) {
  const toggle = useToggleSaved(profileId)

  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ saved: !isSaved })}
      // Disabled only while the request is in flight. The optimistic flip
      // in `useToggleSaved` has already redrawn the button by then, so the
      // user sees the new state immediately and this only prevents a
      // second tap from racing the first.
      disabled={toggle.isPending}
      aria-pressed={isSaved}
      className={`btn-secondary text-sm disabled:opacity-60 ${className}`}
    >
      <BookmarkIcon filled={isSaved} />
      {isSaved ? 'Saved' : 'Save'}
      <span className="sr-only"> profile</span>
    </button>
  )
}
