/**
 * The signed-in chrome.
 *
 * ## Layout
 *
 * Desktop is a **permanently fixed left sidebar** with the main content
 * scrolling beside it. The sidebar is `position: fixed` and owns its own
 * overflow, so it never moves — not on scroll, and not on a long page.
 * That is a real change from the previous shell, which put the sidebar in
 * normal flow inside a `min-h-full` wrapper: the whole document scrolled
 * there, so the navigation slid off the top of the screen on every long
 * page. `lg:pl-64` on the content column reserves the sidebar's width,
 * since a fixed element is out of flow and reserves nothing itself.
 *
 * Mobile is a **fixed bottom bar** (`BottomNav`) rather than the drawer
 * this shell used to open. The header keeps a small overflow menu for the
 * destinations the bar does not carry, so nothing is unreachable.
 *
 * ## Why the sidebar scrolls internally
 *
 * `inset-y-0` pins it to the viewport and `overflow-y-auto` lets the nav
 * itself scroll when it is taller than the screen — a short laptop window
 * with nine destinations plus the account card. Without that, the sign-out
 * button at the bottom would be permanently off-screen and unreachable.
 *
 * The `<nav>` landmarks are labelled so a screen-reader user can jump
 * between "Primary" and "Account" rather than hearing one long list.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Avatar } from '../ui/Avatar'
import { CountBadge } from '../ui/Badge'
import { Logo } from '../ui/Logo'
import { LoadingState } from '../ui/Spinner'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { AccountMenu } from './AccountMenu'
import { BottomNav } from './BottomNav'
import { NotificationBell } from './NotificationBell'
import { SignOutButton } from './SignOutButton'
import { ThemeToggle } from './ThemeToggle'
import {
  NavIcon,
  ACCOUNT_ITEMS,
  MOBILE_OVERFLOW_ITEMS,
  NAV_ITEMS,
} from './navigation'
import { useAuth } from '../../context/AuthContext'
import { useRealtime } from '../../context/RealtimeContext'
import { useUnreadCount } from '../../hooks/useChat'

/** A badge slot, driven by the item's `badge` key rather than its label. */
function NavBadge({ badge, unreadCount, notificationCount }) {
  if (badge === 'unread' && unreadCount > 0) return <CountBadge count={unreadCount} />
  if (badge === 'notifications' && notificationCount > 0) {
    return <CountBadge count={notificationCount} />
  }
  return null
}

export function AppShell() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // The notification count is pushed over the socket, not polled — the
  // same source the bell reads, so the two badges cannot disagree.
  const { isChatConnected, unreadNotifications: notificationCount } = useRealtime()
  const { data: unreadCount = 0 } = useUnreadCount()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Navigating should always close the overflow menu, including a
  // navigation triggered from inside a page.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  // Dismiss the overflow menu on an outside click or Escape. Without this
  // it stays open behind whatever the user taps next, and a keyboard user
  // has no way to close it without tabbing through every entry.
  useEffect(() => {
    if (!isMenuOpen) return undefined
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isMenuOpen])

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
        : 'text-slate-600 hover:bg-sand-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-sand-800 dark:hover:text-slate-200',
    ].join(' ')

  const sidebar = (
    <>
      <Link
        to="/app"
        className="flex items-center px-3 py-2 text-brand-600 dark:text-brand-400"
      >
        <Logo size="md" />
      </Link>

      <nav aria-label="Primary" className="mt-4 flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            <NavIcon>{item.icon}</NavIcon>
            <span className="flex-1">{item.label}</span>
            <NavBadge
              badge={item.badge}
              unreadCount={unreadCount}
              notificationCount={notificationCount}
            />
          </NavLink>
        ))}
      </nav>

      <nav
        aria-label="Account"
        className="mt-4 space-y-1 border-t border-sand-200 pt-4 dark:border-sand-800"
      >
        {ACCOUNT_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <NavIcon>{item.icon}</NavIcon>
            {item.label}
          </NavLink>
        ))}

        <Link
          to="/app/profile"
          className="mt-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sand-100 dark:hover:bg-sand-800"
        >
          <Avatar
            src={user?.photo}
            name={user?.full_name || user?.first_name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {user?.full_name || user?.first_name || 'Your profile'}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.profile_completion ?? 0}% complete
            </p>
          </div>
        </Link>

        {/* A sign-out in the sidebar as well as the header menu. The
            header one is easy to miss on a wide screen, and "how do I log
            out" should never be a question the interface raises. */}
        <SignOutButton />
      </nav>
    </>
  )

  return (
    <div className="min-h-full bg-sand-50 dark:bg-sand-950">
      {/* Skip link: the first focusable element, so a keyboard user can
          jump past the nav on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar — fixed to the viewport, scrolls internally. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-sand-200 bg-sand-50 p-3 dark:border-sand-800 dark:bg-sand-950 lg:flex">
        {sidebar}
      </aside>

      {/* `lg:pl-64` reserves the fixed sidebar's width. */}
      <div className="flex min-h-full min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-sand-200 bg-sand-50/85 px-4 py-2 backdrop-blur dark:border-sand-800 dark:bg-sand-950/85">
          <div className="flex items-center gap-2 lg:hidden">
            <Link to="/app" className="text-brand-600 dark:text-brand-400">
              <Logo size="sm" />
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* A quiet connection indicator. A dropped socket degrades
                the app to HTTP fallbacks, which works — so this is
                informational, not an error. */}
            {!isChatConnected ? (
              <span
                className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 sm:inline-flex"
                title="Reconnecting — messages will be delivered when the connection returns"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Reconnecting
              </span>
            ) : null}
            <NotificationBell />
            <ThemeToggle />

            {/* The overflow menu, mobile only: the destinations the bottom
                bar does not carry (Likes, Notifications, Saved, Settings). */}
            <div className="relative lg:hidden" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-overflow-menu"
                aria-label="More navigation"
                className="rounded-lg p-2 text-slate-500 hover:bg-sand-100 dark:text-slate-400 dark:hover:bg-sand-800"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              {isMenuOpen ? (
                <nav
                  id="mobile-overflow-menu"
                  aria-label="More"
                  className="surface-overlay absolute right-0 z-40 mt-2 w-56 animate-fade-in p-2"
                >
                  <ul className="space-y-0.5">
                    {MOBILE_OVERFLOW_ITEMS.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            [
                              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                                : 'text-slate-600 hover:bg-sand-100 dark:text-slate-400 dark:hover:bg-sand-800',
                            ].join(' ')
                          }
                        >
                          <NavIcon>{item.icon}</NavIcon>
                          <span className="flex-1">{item.label}</span>
                          <NavBadge
                            badge={item.badge}
                            unreadCount={unreadCount}
                            notificationCount={notificationCount}
                          />
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 border-t border-sand-200 pt-1 dark:border-sand-800">
                    <SignOutButton />
                  </div>
                </nav>
              ) : null}
            </div>

            <AccountMenu />
          </div>
        </header>

        {/*
          `pb-24` on mobile clears the fixed bottom bar, which is out of
          flow and reserves nothing. At `lg` the bar is gone, so the
          padding drops back to the normal rhythm.
        */}
        <main id="main" className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          {/*
            The boundary sits inside the shell, not around the route,
            so switching to an unvisited section keeps the sidebar and
            header on screen and swaps only the panel. A boundary one
            level up would blank the whole page on every first visit to
            a section.
          */}
          <Suspense fallback={<LoadingState message="Loading…" />}>
            {/*
              A second, nested boundary: `Suspense` catches a pending
              lazy chunk, not a render error. Without this, one broken
              page unmounts the sidebar and the whole shell with it, and
              the user has no navigation left to get out with.
            */}
            <ErrorBoundary name="AppShell">
              <Outlet />
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>

      <BottomNav
        unreadCount={unreadCount}
        notificationCount={notificationCount}
      />
    </div>
  )
}
