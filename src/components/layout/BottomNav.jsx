/**
 * The mobile bottom navigation bar.
 *
 * Replaces the hamburger drawer the shell used to open. A dating app is
 * used one-handed, and a drawer costs two taps — open, then choose — for
 * the destinations people move between constantly. A bar costs one, and
 * it is always in thumb reach.
 *
 * ## Fixed, and the page pads for it
 *
 * The bar is `fixed bottom-0`. A fixed element is out of flow and reserves
 * no space, so the shell adds matching bottom padding to `<main>`
 * (`pb-24`) — without it the last row of every list sits under the bar and
 * cannot be scrolled clear of it. The padding lives in the shell rather
 * than here because only the shell knows the bar is present.
 *
 * `env(safe-area-inset-bottom)` is added on top, so the bar clears the
 * home indicator on a phone with a gesture bar instead of being partly
 * covered by it.
 *
 * ## Where the items come from
 *
 * `MOBILE_PRIMARY_PATHS` and `MOBILE_OVERFLOW_ITEMS` in `navigation.jsx`
 * are the single definition; this component does not restate them. The
 * overflow menu in the header renders the complement, so between the two
 * every destination is reachable and none is listed twice.
 */

import { NavLink } from 'react-router-dom'

import { CountBadge } from '../ui/Badge'
import {
  ACCOUNT_ITEMS,
  MOBILE_PRIMARY_PATHS,
  NAV_ITEMS,
  NavIcon,
} from './navigation'

export function BottomNav({ unreadCount = 0, notificationCount = 0 }) {
  // Profile lives in ACCOUNT_ITEMS on desktop, but it earns a bottom-bar
  // slot: it is the most-visited destination and the one people check
  // after any edit. Pulled from ACCOUNT_ITEMS rather than restated, so its
  // icon and label cannot drift from the sidebar's.
  const barItems = [
    ...NAV_ITEMS,
    ...ACCOUNT_ITEMS.filter((item) => item.to === '/app/profile'),
  ].filter((item) => MOBILE_PRIMARY_PATHS.includes(item.to))

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-sand-800 dark:bg-sand-950/95 lg:hidden"
    >
      <ul className="flex items-stretch">
        {barItems.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  // min-h-14 keeps the target comfortably past the 44px
                  // minimum on every device, including a short bar.
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-2xs font-medium transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <NavIcon className="h-6 w-6" />
                    {item.badge === 'unread' && unreadCount > 0 ? (
                      <span className="absolute -right-2 -top-1.5">
                        <CountBadge count={unreadCount} />
                      </span>
                    ) : null}
                    {item.badge === 'notifications' && notificationCount > 0 ? (
                      <span className="absolute -right-2 -top-1.5">
                        <CountBadge count={notificationCount} />
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                  {/*
                    The active destination is signalled by colour alone,
                    which a screen reader cannot perceive and a
                    colour-blind user may miss. `aria-current` carries it
                    semantically; the dot is the visual echo. The inactive
                    branch keeps an equal-height spacer so the labels do
                    not shift by a pixel when the active route changes.
                  */}
                  <span
                    className={[
                      'h-1 w-1 rounded-full',
                      isActive ? 'bg-brand-600 dark:bg-brand-400' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
