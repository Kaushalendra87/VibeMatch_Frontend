/**
 * The signed-in navigation, defined once.
 *
 * Three surfaces render this list — the desktop sidebar, the mobile bottom
 * bar and the mobile overflow menu — and before this module each would
 * have carried its own copy. They have to agree on paths and labels, or
 * the same destination appears under two names depending on screen size.
 *
 * ## What is deliberately absent
 *
 * Every entry here resolves to a real route in `routes/AppRoutes.jsx`.
 * Nothing is listed that would 404.
 *
 * There is **no "Posts" entry**, because there is no `Post` model and no
 * posts endpoint — the only user-uploaded media is the profile photo
 * gallery. A Posts destination would have nothing to render.
 *
 * "Saved" is listed, but the page behind it is an honest placeholder: the
 * bookmark feature has no model, endpoint or route anywhere in the API.
 * The entry exists because the destination is specified; the page says so
 * rather than inventing rows.
 *
 * "Home" and "Messages" are the labels for the routes the API and router
 * already call `Overview` and `Chat` — the paths are unchanged, only the
 * wording the user sees.
 */

/** Shared icon wrapper, so every glyph has one stroke weight and box. */
export function NavIcon({ children, className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/**
 * The primary destinations, in the order they appear everywhere.
 *
 * `badge` names which live counter decorates the entry, rather than
 * matching on the label string — the previous shell compared
 * `item.label === 'Chat'`, which silently stops working the moment the
 * label is reworded (and it was reworded, to "Messages").
 */
export const NAV_ITEMS = [
  {
    to: '/app',
    end: true,
    label: 'Home',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.5Z"
      />
    ),
  },
  {
    to: '/app/discover',
    label: 'Discover',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20.5 20.5l-4.5-4.5"
      />
    ),
  },
  {
    to: '/app/matches',
    label: 'Matches',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.9M16 3.6a4 4 0 0 1 0 7.8"
      />
    ),
  },
  {
    to: '/app/chat',
    label: 'Messages',
    badge: 'unread',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z"
      />
    ),
  },
  {
    to: '/app/likes',
    label: 'Likes',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.5 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13L12 20.5Z"
      />
    ),
  },
  {
    to: '/app/notifications',
    label: 'Notifications',
    badge: 'notifications',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5ZM13.7 20a2 2 0 0 1-3.4 0"
      />
    ),
  },
  {
    to: '/app/saved',
    label: 'Saved',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z"
      />
    ),
  },
]

/** The account destinations, kept separate so the sidebar can group them. */
export const ACCOUNT_ITEMS = [
  {
    to: '/app/profile',
    label: 'Profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 20.5a7.5 7.5 0 0 1 15 0"
        />
      </>
    ),
  },
  {
    to: '/app/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.8 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.6 1.2Z"
        />
      </>
    ),
  },
]

/**
 * What fits in a bottom bar.
 *
 * Five, because that is what a thumb can reach across without the bar
 * turning into a second navigation problem — the same reason the platform
 * tab bars cap out there. The remaining destinations stay reachable from
 * the header's overflow menu, so nothing is lost by not being here.
 *
 * Profile is included rather than Notifications: the bell already lives in
 * the header on every screen size, so a bottom-bar slot for it would spend
 * a fifth of the bar duplicating a control that is already in reach.
 */
export const MOBILE_PRIMARY_PATHS = [
  '/app',
  '/app/discover',
  '/app/matches',
  '/app/chat',
  '/app/profile',
]

/** The overflow menu on mobile: everything the bottom bar does not carry. */
export const MOBILE_OVERFLOW_ITEMS = [...NAV_ITEMS, ...ACCOUNT_ITEMS].filter(
  (item) => !MOBILE_PRIMARY_PATHS.includes(item.to),
)
