/**
 * The unauthenticated shell: centred card, brand mark, theme toggle.
 *
 * The theme toggle is present here deliberately — a user who prefers dark
 * mode should not have to sign in to get it.
 *
 * This is the first screen a stranger sees, so it carries the wordmark in
 * the display serif. That is the whole art direction here: a soft serif,
 * a warm off-white, and nothing else. An earlier pass lit this screen
 * with drifting background washes; they were removed because a sign-in
 * page that glows reads as a template, and because the honest job of this
 * screen is to get out of the way.
 */

import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Logo } from '../components/ui/Logo'
import { LoadingState } from '../components/ui/Spinner'

export function AuthLayout() {
  return (
    <div className="flex min-h-full flex-col bg-sand-50 dark:bg-sand-950">
      <header className="flex items-center justify-between p-4">
        <Link
          to="/"
          className="flex items-center text-brand-600 dark:text-brand-400"
        >
          <Logo size="md" />
        </Link>
        <ThemeToggle />
      </header>

      <main id="main" className="flex flex-1 items-center justify-center p-4 pb-16">
        {/* The auth pages are the most likely first paint for a signed-out
            visitor, so their chunk is fetched immediately — but the
            boundary is still needed, because "immediately" is still a
            round trip. */}
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
