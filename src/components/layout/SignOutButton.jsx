/**
 * A plain, always-visible sign-out.
 *
 * The header's `AccountMenu` also signs out, but a menu is a place you
 * have to know to look. On a wide screen the avatar sits in the far
 * corner, and the single most important affordance on a shared machine —
 * ending the session — should not be behind a click that a user has to
 * discover. This sits in the sidebar under the user's own name, where
 * someone scanning for "log out" will find it.
 *
 * Extracted so `AppShell` and `AdminShell` cannot diverge. The admin
 * console had no sign-out at all, which is how this whole fix started.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'

export function SignOutButton({ className = '' }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
        'text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600',
        'disabled:opacity-50',
        'dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400',
        className,
      ].join(' ')}
    >
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
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
  )
}
