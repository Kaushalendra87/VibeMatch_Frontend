/**
 * Route guards.
 *
 * All three wait on `isBooting`. That is not a nicety: the access token
 * lives in memory, so on a fresh load there is a moment where the user is
 * genuinely unknown. Redirecting to `/login` during that window would
 * bounce every signed-in user to the login screen on every refresh.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { LoadingState } from '../components/ui/Spinner'

/** Signed in, and email confirmed. */
export function ProtectedRoute() {
  const { isAuthenticated, isBooting, isEmailVerified } = useAuth()
  const location = useLocation()

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading your account…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // `state.from` lets the login page send the user back where they were
    // headed, which matters for a deep link into a conversation.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}

/** Not signed in. Bounces a signed-in user away from the login form. */
export function PublicOnlyRoute() {
  const { isAuthenticated, isBooting } = useAuth()

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading…" />
      </div>
    )
  }

  if (isAuthenticated) return <Navigate to="/app" replace />

  return <Outlet />
}

/**
 * Staff only.
 *
 * The client check is a convenience that avoids rendering a dashboard the
 * user cannot use — it is **not** the access control. Every admin
 * endpoint enforces its own permission server-side; this only decides
 * what to render.
 */
export function StaffRoute() {
  const { isStaff, isBooting } = useAuth()

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Checking permissions…" />
      </div>
    )
  }

  if (!isStaff) return <Navigate to="/app" replace />

  return <Outlet />
}

/** Admin only — a strictly narrower check than `StaffRoute`. */
export function AdminRoute() {
  const { isAdmin, isBooting } = useAuth()

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Checking permissions…" />
      </div>
    )
  }

  if (!isAdmin) return <Navigate to="/app" replace />

  return <Outlet />
}
