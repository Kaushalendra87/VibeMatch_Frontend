/**
 * Route guards.
 *
 * These are security-relevant rather than cosmetic, and the reason is
 * narrow and worth stating: **the client guard is not the access control.**
 * Every admin endpoint enforces its own permission server-side. What the
 * guard decides is whether a user is shown a page — and the failure that
 * matters is the *other* direction: a guard that sends a legitimate user
 * away, or worse, one that renders a protected page for the wrong person
 * while the server call is still in flight.
 *
 * So the tests below are mostly about the boot window and about the two
 * conditions that are easy to conflate: "not signed in" and "signed in but
 * unverified". They also pin that a guard redirect *preserves where the
 * user was going*, because a lost `state.from` turns a deep link into a
 * trip through the dashboard.
 *
 * `AuthContext` is mocked rather than driven through a real provider. A
 * real provider would fire `refreshSession()` on mount, which is a network
 * call, and the guard's behaviour would then depend on a mock HTTP layer
 * rather than on the flag under test. The provider has its own tests for
 * the boot sequence; these tests are about what the guards do with the
 * result.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import {
  AdminRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  StaffRoute,
} from './ProtectedRoute'

// ── Auth context mock ────────────────────────────────────────────────
const authState = {
  isAuthenticated: false,
  isBooting: false,
  isEmailVerified: false,
  isStaff: false,
  isAdmin: false,
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

function setAuth(overrides) {
  Object.assign(authState, {
    isAuthenticated: false,
    isBooting: false,
    isEmailVerified: false,
    isStaff: false,
    isAdmin: false,
    ...overrides,
  })
}

/**
 * Render a guard inside a router with a reachable protected child and a
 * distinguishable destination for each redirect.
 *
 * The redirect targets render their own text so a test can assert *which*
 * redirect happened, not merely that one did — `/login` and `/verify-email`
 * are different outcomes and a guard that sent an unverified user to the
 * login form would be a bug this catches.
 */
function renderGuard(Guard, { initialPath = '/app' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Guard />}>
          <Route path="/app" element={<div>protected content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/verify-email" element={<div>verify email page</div>} />
        <Route path="/admin" element={<div>admin content</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('renders the child for a verified signed-in user', () => {
    setAuth({ isAuthenticated: true, isEmailVerified: true })

    renderGuard(ProtectedRoute)

    expect(screen.getByText('protected content')).toBeInTheDocument()
  })

  it('redirects an anonymous visitor to the login page', () => {
    setAuth({ isAuthenticated: false })

    renderGuard(ProtectedRoute)

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('sends a signed-in but unverified user to verification, not to login', () => {
    // The distinction matters: this user has a valid session. Sending them
    // to the login form would tell them their password is wrong, and they
    // would try again rather than confirming their address.
    setAuth({ isAuthenticated: true, isEmailVerified: false })

    renderGuard(ProtectedRoute)

    expect(screen.getByText('verify email page')).toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('never renders the protected child while booting', () => {
    // The access token is in memory, so on a reload there is a window
    // where a signed-in user looks anonymous. Rendering the child here
    // would be rendering it with no user; redirecting would bounce every
    // signed-in user to /login on every refresh.
    setAuth({ isBooting: true, isAuthenticated: false })

    renderGuard(ProtectedRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('waits out the boot window even when it already looks signed in', () => {
    // The mirror case: a stale `isAuthenticated` during boot must not be
    // trusted either. Whichever way the boot resolves, the guard renders
    // the same loading state.
    setAuth({ isBooting: true, isAuthenticated: true, isEmailVerified: true })

    renderGuard(ProtectedRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('preserves where the user was going when it redirects to login', () => {
    // A deep link into a conversation must survive the login round trip.
    // Without `state.from` the user lands on the dashboard and has to
    // navigate back, which for a notification link is a lost destination.
    setAuth({ isAuthenticated: false })

    function CaptureFrom() {
      const location = useLocation()
      return <div>from: {location.state?.from?.pathname ?? 'none'}</div>
    }

    render(
      <MemoryRouter initialEntries={['/app/messages/42']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app/messages/:id" element={<div>thread</div>} />
          </Route>
          <Route path="/login" element={<CaptureFrom />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('from: /app/messages/42')).toBeInTheDocument()
  })
})

describe('PublicOnlyRoute', () => {
  it('shows the form to an anonymous visitor', () => {
    setAuth({ isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>login page</div>} />
          </Route>
          <Route path="/app" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('bounces a signed-in user away from the login form', () => {
    setAuth({ isAuthenticated: true })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>login page</div>} />
          </Route>
          <Route path="/app" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('does not bounce during boot, when the user is genuinely unknown', () => {
    setAuth({ isBooting: true, isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>login page</div>} />
          </Route>
          <Route path="/app" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })
})

describe('StaffRoute', () => {
  it('admits staff', () => {
    setAuth({ isAuthenticated: true, isEmailVerified: true, isStaff: true })

    renderGuard(StaffRoute)

    expect(screen.getByText('protected content')).toBeInTheDocument()
  })

  it('refuses an ordinary user', () => {
    setAuth({ isAuthenticated: true, isEmailVerified: true, isStaff: false })

    renderGuard(StaffRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('refuses an anonymous visitor', () => {
    setAuth({ isStaff: false })

    renderGuard(StaffRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })
})

describe('AdminRoute', () => {
  it('admits an admin', () => {
    setAuth({ isAuthenticated: true, isEmailVerified: true, isAdmin: true })

    renderGuard(AdminRoute)

    expect(screen.getByText('protected content')).toBeInTheDocument()
  })

  it('refuses a moderator who is staff but not an admin', () => {
    // The whole reason `AdminRoute` exists alongside `StaffRoute`: staff
    // is the wider set, and a moderator must not reach admin-only pages.
    setAuth({ isAuthenticated: true, isEmailVerified: true, isStaff: true, isAdmin: false })

    renderGuard(AdminRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('refuses an ordinary user', () => {
    setAuth({ isAuthenticated: true, isEmailVerified: true })

    renderGuard(AdminRoute)

    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })
})
