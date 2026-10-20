/**
 * The admin chrome: a sidebar of sections, and the staff context banner.
 *
 * Separate from `AppShell` rather than a mode of it. The two share the
 * API client and the session but nothing else — different navigation,
 * different header, and an admin needs a persistent reminder that they
 * are looking at other people's data, which the user shell has no place
 * for.
 *
 * **The nav is filtered by role, and the filtering is cosmetic.** A
 * moderator does not see Billing because every billing route is
 * `IsAdmin` and the screen would be a wall of 403s. But hiding the link
 * is not the control — the server refuses the request either way. If
 * this list were wrong, a moderator would see an error page, not gain
 * access.
 */

import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Avatar } from '../ui/Avatar'
import { LoadingState } from '../ui/Spinner'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { AccountMenu } from '../layout/AccountMenu'
import { SignOutButton } from '../layout/SignOutButton'
import { ThemeToggle } from '../layout/ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../utils/constants'

/**
 * Every admin destination.
 *
 * `adminOnly` marks the sections whose API is `IsAdmin` — role changes,
 * settings, refunds, impersonation. Everything else is readable by a
 * moderator.
 */
const SECTIONS = [
  {
    group: 'Insights',
    items: [
      {
        to: '/admin',
        end: true,
        label: 'Overview',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.5 19.5h17M6.5 16V9m4 7V5m4 11v-5m4 5V8"
          />
        ),
      },
      {
        to: '/admin/analytics',
        label: 'Analytics',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19V5m0 14h16M8 15l3.5-4 3 2.5L19 8"
          />
        ),
      },
    ],
  },
  {
    group: 'People',
    items: [
      {
        to: '/admin/users',
        label: 'Users',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.9M16 3.6a4 4 0 0 1 0 7.8"
          />
        ),
      },
      {
        to: '/admin/verifications',
        label: 'Verification',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.5 11 14.5 15.5 10M12 3.5l7 3v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5v-6l7-3Z"
          />
        ),
      },
      {
        to: '/admin/photos',
        label: 'Photos',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16.5 8 12l3 3 4-5 5 6.5M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
          />
        ),
      },
    ],
  },
  {
    group: 'Trust & safety',
    items: [
      {
        to: '/admin/reports',
        label: 'Reports',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
          />
        ),
      },
      {
        to: '/admin/moderation-log',
        label: 'Action log',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2Zm0 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M9 11h6M9 15h4"
          />
        ),
      },
    ],
  },
  {
    group: 'Revenue',
    items: [
      {
        to: '/admin/billing/plans',
        label: 'Plans',
        adminOnly: true,
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9ZM3 10h18"
          />
        ),
      },
      {
        to: '/admin/billing/subscriptions',
        label: 'Subscriptions',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4.5v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 19.5v-4h4"
          />
        ),
      },
      {
        to: '/admin/billing/payments',
        label: 'Payments',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 8h10M7 12h6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          />
        ),
      },
    ],
  },
  {
    group: 'Configuration',
    items: [
      {
        to: '/admin/matching',
        label: 'Matching',
        adminOnly: true,
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"
          />
        ),
      },
      {
        to: '/admin/settings',
        label: 'Settings',
        adminOnly: true,
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
      {
        to: '/admin/audit',
        label: 'Audit log',
        adminOnly: true,
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
          />
        ),
      },
    ],
  },
]

function NavIcon({ children }) {
  return (
    <svg
      className="h-5 w-5 shrink-0"
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

export function AdminShell() {
  const { user, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
        : 'text-slate-600 hover:bg-sand-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-sand-800 dark:hover:text-slate-200',
    ].join(' ')

  // One flat list, so the mobile drawer does not have to re-derive the
  // grouping. The `group` labels are only rendered in the sidebar.
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0)

  const sidebar = (
    <>
      <Link
        to="/admin"
        className="flex items-center gap-2 px-3 py-2 text-lg font-bold text-brand-600 dark:text-brand-400"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4Zm0 4.5 4 2v3.5c0 3-1.7 5.6-4 6.2-2.3-.6-4-3.2-4-6.2V8.5l4-2Z" />
        </svg>
        VibeMatch
        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Admin
        </span>
      </Link>

      <nav aria-label="Admin sections" className="mt-4 flex-1 space-y-4">
        {visibleSections.map((section) => (
          <div key={section.group}>
            <p className="eyebrow px-3 pb-1">
              {section.group}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-1 border-t border-sand-200 pt-4 dark:border-sand-800">
        <Link to="/app" className={navLinkClass({ isActive: false })}>
          <NavIcon>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6m4 0h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M12 3v18"
            />
          </NavIcon>
          Back to the app
        </Link>

        <div className="mt-2 flex items-center gap-3 rounded-lg p-2">
          <Avatar src={user?.photo} name={user?.full_name || user?.email} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {user?.full_name || user?.email}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.role === ROLES.ADMIN ? 'Administrator' : 'Moderator'}
            </p>
          </div>
        </div>

        {/* The admin console had no way to sign out at all — a moderator
            was stuck here. Both a menu in the header and this button, so
            the exit is visible without hunting for it. */}
        <SignOutButton className="mt-1" />
      </div>
    </>
  )

  return (
    <div className="flex min-h-full flex-col bg-sand-50 dark:bg-sand-950">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex w-full max-w-admin flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sand-200 p-3 dark:border-sand-800 lg:flex">
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-sand-200 bg-sand-50/85 px-4 py-2 backdrop-blur dark:border-sand-800 dark:bg-sand-950/85">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                aria-expanded={isMobileMenuOpen}
                aria-controls="admin-mobile-nav"
                aria-label="Toggle navigation menu"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
              <Link to="/admin" className="text-base font-bold text-brand-600 dark:text-brand-400">
                Admin
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/*
                A standing reminder. An admin is looking at other people's
                private data, and the one thing that must never be
                ambiguous is whether the current session is being audited.
              */}
              <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-sage-500" aria-hidden="true" />
                Actions are logged
              </span>
              <ThemeToggle />
              <AccountMenu showAdminLink={false} />
            </div>
          </header>

          {isMobileMenuOpen ? (
            <nav
              id="admin-mobile-nav"
              aria-label="Admin sections"
              className="animate-fade-in space-y-3 border-b border-sand-200 bg-white p-3 dark:border-sand-800 dark:bg-sand-900 lg:hidden"
            >
              {visibleSections.map((section) => (
                <div key={section.group}>
                  <p className="eyebrow px-3 pb-1">
                    {section.group}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={navLinkClass}
                      >
                        <NavIcon>{item.icon}</NavIcon>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <Link to="/app" className={navLinkClass({ isActive: false })}>
                <NavIcon>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M10.5 19.5H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
                </NavIcon>
                Back to the app
              </Link>
            </nav>
          ) : null}

          <main id="admin-main" className="flex-1 p-4 sm:p-6">
            {/* See AppShell — the boundary is inside the chrome so the
                sidebar survives a section's first load, and the nested
                error boundary keeps it alive through a broken page. */}
            <Suspense fallback={<LoadingState message="Loading…" />}>
              <ErrorBoundary name="AdminShell">
                <Outlet />
              </ErrorBoundary>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
