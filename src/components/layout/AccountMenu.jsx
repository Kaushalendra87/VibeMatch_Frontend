/**
 * The account menu: who you are, and the way out.
 *
 * **Why this exists.** Before it, the only `logout()` call in the entire
 * frontend was inside the account-*deletion* flow. There was no sign-out
 * control anywhere — not in `AppShell`, not in `AdminShell` — so a
 * signed-in user had no way to end their session short of clearing
 * cookies, and a moderator was stuck inside `/admin` with no exit at all.
 * That is a security problem, not a cosmetic one: the one action a shared
 * or borrowed machine needs most was the one action missing.
 *
 * It lives in one component and is mounted by both shells rather than
 * duplicated, so the two cannot drift — the admin shell's copy silently
 * losing its sign-out is exactly the bug being fixed.
 *
 * The dropdown pattern (outside click, Escape, `aria-haspopup`) is
 * deliberately the same as `NotificationBell`'s, so the two menus in the
 * header behave identically.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Avatar } from '../ui/Avatar'
import { useAuth } from '../../context/AuthContext'

function MenuIcon({ children }) {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function AccountMenu({ align = 'right', showAdminLink = true }) {
  const navigate = useNavigate()
  const { user, logout, isStaff } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      // `logout()` clears the token even if the request fails, so the
      // local session ends either way — the refresh cookie may outlive
      // the call, but it is httpOnly and unusable without a token.
      await logout()
    } finally {
      // Navigate rather than letting the guard react: a `Navigate` would
      // render the same thing, but this also drops any `state.from` the
      // user was carrying, so signing back in lands on the dashboard
      // rather than back in whatever deep link they were in.
      navigate('/login', { replace: true })
    }
  }

  const displayName = user?.full_name || user?.first_name || user?.email || 'Account'
  const subtitle =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role === 'moderator'
        ? 'Moderator'
        : (user?.email ?? '')

  const itemClass =
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-sand-100 dark:text-slate-300 dark:hover:bg-sand-800'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${displayName}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-sand-100 dark:hover:bg-sand-800"
      >
        <Avatar src={user?.photo} name={displayName} size="sm" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Account"
          className={[
            'absolute z-40 mt-2 w-60 origin-top animate-fade-in overflow-hidden',
            'surface-overlay',
            'dark:border-sand-800 dark:bg-sand-900',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 border-b border-sand-200 px-4 py-3 dark:border-sand-800">
            <Avatar src={user?.photo} name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="p-1.5">
            <Link to="/app/profile" onClick={() => setIsOpen(false)} className={itemClass}>
              <MenuIcon>
                <circle cx="12" cy="8" r="3.5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 20.5a7.5 7.5 0 0 1 15 0"
                />
              </MenuIcon>
              My profile
            </Link>

            <Link to="/app/settings" onClick={() => setIsOpen(false)} className={itemClass}>
              <MenuIcon>
                <circle cx="12" cy="12" r="3" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.8 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.6 1.2Z"
                />
              </MenuIcon>
              Settings
            </Link>

            {/* A moderator or admin gets a way into the console; a plain
                user never sees a link to a dashboard they cannot open. */}
            {isStaff && showAdminLink ? (
              <Link to="/admin" onClick={() => setIsOpen(false)} className={itemClass}>
                <MenuIcon>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4Z"
                  />
                </MenuIcon>
                Admin console
              </Link>
            ) : null}
          </div>

          <div className="border-t border-sand-200 p-1.5 dark:border-sand-800">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"
                />
              </svg>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
