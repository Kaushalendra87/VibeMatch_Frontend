/**
 * The route table.
 *
 * Structure mirrors the two dashboards: `/app/*` is the user dashboard,
 * `/admin/*` is the admin one. The admin routes are mounted here rather
 * than in a separate app because they share the API client, the session
 * and the realtime sockets — a second bundle would have to rebuild all
 * three.
 *
 * The guards are convenience, not access control. Every admin endpoint
 * enforces its own permissions server-side; `StaffRoute` only decides
 * what to render.
 *
 * **Every page is loaded on demand.** The initial bundle was 925 kB,
 * and the bulk of it was the admin console — fourteen screens plus
 * Recharts, which exactly one of them uses. A regular user never opens
 * any of it, so shipping it in the entry chunk made every first paint
 * wait on code that would never run.
 *
 * The chrome (`AppShell`, `AdminShell`, `AuthLayout`) stays static. Two
 * reasons: it renders on its own route rather than suspending behind a
 * chunk, and each one owns the `<Suspense>` boundary its pages resolve
 * into — a boundary cannot catch the suspension of the component that
 * renders it, so a lazy shell would need a second boundary above it and
 * would blank the whole screen instead of just the panel. The three
 * together are ~20 kB.
 */

import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { AdminShell } from '../components/admin/AdminShell'
import { AuthLayout } from './AuthLayout'
import { ProtectedRoute, PublicOnlyRoute, StaffRoute } from './ProtectedRoute'
import { NotFoundPage } from '../pages/NotFoundPage'

/**
 * A named export behind `React.lazy`.
 *
 * `lazy()` wants a module with a `default` export; every page here uses
 * a named one, and rewriting thirty modules' exports to suit the
 * bundler would be the tail wagging the dog. The name is passed
 * explicitly rather than inferred so the call site reads as the
 * component it produces.
 */
const page = (loader, name) =>
  lazy(() => loader().then((module) => ({ default: module[name] })))

// Admin
const AdminOverviewPage = page(() => import('../pages/admin/AdminOverviewPage'), 'AdminOverviewPage')
const AdminAnalyticsPage = page(() => import('../pages/admin/AdminAnalyticsPage'), 'AdminAnalyticsPage')
const AdminUsersPage = page(() => import('../pages/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminUserDetailPage = page(() => import('../pages/admin/AdminUserDetailPage'), 'AdminUserDetailPage')
const AdminVerificationsPage = page(() => import('../pages/admin/AdminVerificationsPage'), 'AdminVerificationsPage')
const AdminPhotosPage = page(() => import('../pages/admin/AdminPhotosPage'), 'AdminPhotosPage')
const AdminReportsPage = page(() => import('../pages/admin/AdminReportsPage'), 'AdminReportsPage')
const AdminReportDetailPage = page(() => import('../pages/admin/AdminReportDetailPage'), 'AdminReportDetailPage')
const AdminModerationLogPage = page(() => import('../pages/admin/AdminModerationLogPage'), 'AdminModerationLogPage')
const AdminPlansPage = page(() => import('../pages/admin/AdminPlansPage'), 'AdminPlansPage')
const AdminSubscriptionsPage = page(() => import('../pages/admin/AdminSubscriptionsPage'), 'AdminSubscriptionsPage')
const AdminPaymentsPage = page(() => import('../pages/admin/AdminPaymentsPage'), 'AdminPaymentsPage')
const AdminMatchingPage = page(() => import('../pages/admin/AdminMatchingPage'), 'AdminMatchingPage')
const AdminSettingsPage = page(() => import('../pages/admin/AdminSettingsPage'), 'AdminSettingsPage')
const AdminAuditLogPage = page(() => import('../pages/admin/AdminAuditLogPage'), 'AdminAuditLogPage')

// Auth
const LoginPage = page(() => import('../pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = page(() => import('../pages/auth/RegisterPage'), 'RegisterPage')
const VerifyEmailPage = page(() => import('../pages/auth/VerifyEmailPage'), 'VerifyEmailPage')
const ForgotPasswordPage = page(() => import('../pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = page(() => import('../pages/auth/ResetPasswordPage'), 'ResetPasswordPage')

// Dashboard
const OverviewPage = page(() => import('../pages/dashboard/OverviewPage'), 'OverviewPage')
const DiscoverPage = page(() => import('../pages/dashboard/DiscoverPage'), 'DiscoverPage')
const LikesPage = page(() => import('../pages/dashboard/LikesPage'), 'LikesPage')
const MatchesPage = page(() => import('../pages/dashboard/MatchesPage'), 'MatchesPage')
const ChatPage = page(() => import('../pages/dashboard/ChatPage'), 'ChatPage')
const ProfilePage = page(() => import('../pages/dashboard/ProfilePage'), 'ProfilePage')
const NotificationsPage = page(() => import('../pages/dashboard/NotificationsPage'), 'NotificationsPage')
const SavedPage = page(() => import('../pages/dashboard/SavedPage'), 'SavedPage')
const SettingsPage = page(() => import('../pages/dashboard/SettingsPage'), 'SettingsPage')
const SubscriptionPage = page(() => import('../pages/dashboard/SubscriptionPage'), 'SubscriptionPage')
const SafetyPage = page(() => import('../pages/dashboard/SafetyPage'), 'SafetyPage')
const MatchDetailPage = page(() => import('../pages/dashboard/MatchDetailPage'), 'MatchDetailPage')
const PublicProfilePage = page(() => import('../pages/dashboard/PublicProfilePage'), 'PublicProfilePage')

export function AppRoutes() {
  return (
    <Routes>
      {/* Public landing — sends a signed-in user straight through. */}
      <Route index element={<Navigate to="/app" replace />} />

      {/* Unauthenticated */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>

      {/*
        Verification sits outside both guards: the user is authenticated
        enough to have a token in some flows and not in others, and the
        whole point is that they cannot get in yet.
      */}
      <Route element={<AuthLayout />}>
        <Route path="verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* User dashboard */}
      <Route element={<ProtectedRoute />}>
        <Route path="app" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="likes" element={<LikesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          {/* A real route over a real endpoint, unlike `saved` below. */}
          <Route path="saved" element={<SavedPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="matches/:matchId" element={<MatchDetailPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:conversationId" element={<ChatPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Addressed by profile UUID — what every card carries. */}
          <Route path="profile/:profileId" element={<PublicProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="safety" element={<SafetyPage />} />
        </Route>
      </Route>

      {/*
        Admin dashboard.

        Nested under `AdminShell` so the sidebar, the staff banner and the
        "actions are logged" reminder persist across every admin screen
        rather than being re-rendered per page.

        Paths mirror the API exactly — `/admin/billing/plans` renders the
        page that talks to `/api/admin/billing/plans/`. Keeping them
        aligned means a URL in a bug report names both the screen and the
        endpoint.
      */}
      <Route element={<StaffRoute />}>
        <Route path="admin" element={<AdminShell />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          {/* Addressed by integer pk — `User` is not UUID-keyed. */}
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="verifications" element={<AdminVerificationsPage />} />
          <Route path="photos" element={<AdminPhotosPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          {/* Addressed by UUID — `Report` is UUID-keyed. */}
          <Route path="reports/:reportId" element={<AdminReportDetailPage />} />
          <Route path="moderation-log" element={<AdminModerationLogPage />} />
          <Route path="billing/plans" element={<AdminPlansPage />} />
          <Route path="billing/subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="billing/payments" element={<AdminPaymentsPage />} />
          <Route path="matching" element={<AdminMatchingPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit" element={<AdminAuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
