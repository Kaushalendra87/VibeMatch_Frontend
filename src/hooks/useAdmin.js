/**
 * Admin dashboard queries and mutations.
 *
 * The invalidation rule for this module: **a mutation invalidates every
 * screen whose numbers it moves, not just the one it was called from.**
 * Suspending a user changes the user table, the overview's
 * `suspended_users` count and the audit log. Deciding a report changes
 * the queue, the overview's `open_reports` count and — if it suspended
 * someone — the user table too. Refreshing only the originating list
 * leaves a dashboard that disagrees with itself, which is worse than a
 * slow one.
 *
 * So each mutation names the whole set it affects. The `['admin']`
 * prefix would be simpler still, but it refetches the analytics
 * timeseries on every keystroke-level action, which is a lot of queries
 * for a checkbox.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as adminApi from '../services/admin'
import { queryKeys } from './queryKeys'

// ── Analytics ────────────────────────────────────────────────────────
export function useAdminOverview(options = {}) {
  return useQuery({
    queryKey: queryKeys.adminOverview(),
    queryFn: adminApi.fetchOverview,
    // Live figures, so they go stale quickly — but not so quickly that
    // every tab focus re-runs eight aggregate queries.
    staleTime: 60 * 1000,
    ...options,
  })
}

export function useAdminTimeseries(days = 30, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminTimeseries(days),
    queryFn: () => adminApi.fetchTimeseries({ days }),
    // The rollup only changes when the nightly job runs, so within a
    // session this is effectively static.
    staleTime: 10 * 60 * 1000,
    ...options,
  })
}

export function useAdminCohorts(weeks = 8, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCohorts(weeks),
    queryFn: () => adminApi.fetchCohorts({ weeks }),
    staleTime: 10 * 60 * 1000,
    ...options,
  })
}

// ── Users ────────────────────────────────────────────────────────────
export function useAdminUsers(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: () => adminApi.fetchUsers(filters),
    // Keeps the previous page on screen while the next one loads, so the
    // table does not collapse to a skeleton on every page change.
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useAdminUser(userId, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminUser(userId),
    queryFn: () => adminApi.fetchUser(userId),
    enabled: Boolean(userId),
    ...options,
  })
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, ...payload }) => adminApi.updateUser(userId, payload),
    onSuccess: (user) => {
      // Seed the detail cache with the server's own response — it
      // recomputes `status_display` and `is_staff` from what was saved,
      // so guessing locally would disagree for a role change.
      queryClient.setQueryData(queryKeys.adminUser(user.id), user)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

// ── Moderation ───────────────────────────────────────────────────────
export function useAdminReports(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminReports(filters),
    queryFn: () => adminApi.fetchReportQueue(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useAdminReport(reportId, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminReport(reportId),
    queryFn: () => adminApi.fetchReport(reportId),
    enabled: Boolean(reportId),
    ...options,
  })
}

export function useClaimReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reportId) => adminApi.claimReport(reportId),
    onSuccess: (report) => {
      if (report?.id) queryClient.setQueryData(queryKeys.adminReport(report.id), report)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}

export function useDecideReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reportId, ...payload }) => adminApi.decideReport(reportId, payload),
    onSuccess: (report) => {
      if (report?.id) queryClient.setQueryData(queryKeys.adminReport(report.id), report)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminModerationLog() })
      // A suspension or ban changes the user's row as well as the report.
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
    },
  })
}

export function useAdminVerifications(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminVerifications(filters),
    queryFn: () => adminApi.fetchVerificationQueue(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useDecideVerification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, ...payload }) =>
      adminApi.decideVerification(requestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminModerationLog() })
      // Approval sets the badge, which the user table shows.
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminPhotos(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminPhotos(filters),
    queryFn: () => adminApi.fetchPhotoQueue(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useDecidePhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ photoId, ...payload }) => adminApi.decidePhoto(photoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminModerationLog() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

export function useDecidePhotosBulk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => adminApi.decidePhotosBulk(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminModerationLog() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

export function useAdminModerationLog(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminModerationLog(filters),
    queryFn: () => adminApi.fetchModerationLog(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

// ── Billing ──────────────────────────────────────────────────────────
export function useAdminPlans(options = {}) {
  return useQuery({
    queryKey: queryKeys.adminPlans(),
    queryFn: adminApi.fetchPlans,
    // Plans change only when an admin edits one, and that invalidates.
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useSavePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planId, ...payload }) =>
      planId ? adminApi.updatePlan(planId, payload) : adminApi.createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlans() })
      // Subscriptions embed the full plan object, so they are now stale.
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
    },
  })
}

export function useDeletePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId) => adminApi.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlans() })
    },
  })
}

export function useAdminSubscriptions(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminSubscriptions(filters),
    queryFn: () => adminApi.fetchSubscriptions(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useAdminPayments(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminPayments(filters),
    queryFn: () => adminApi.fetchPayments(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useRefundPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paymentId, ...payload }) =>
      adminApi.refundPayment(paymentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      // A refund moves revenue and the refund total on the overview.
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

// ── Settings, flags, audit ───────────────────────────────────────────
export function useAdminSettings(options = {}) {
  return useQuery({
    queryKey: queryKeys.adminSettings(),
    queryFn: adminApi.fetchSettings,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, value }) => adminApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

export function useAdminFlags(options = {}) {
  return useQuery({
    queryKey: queryKeys.adminFlags(),
    queryFn: adminApi.fetchFeatureFlags,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, enabled }) => adminApi.updateFeatureFlag(name, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminFlags() })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

export function useAdminAuditLog(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminAuditLog(filters),
    queryFn: () => adminApi.fetchAuditLog(filters),
    placeholderData: (previous) => previous,
    ...options,
  })
}

// ── Impersonation ────────────────────────────────────────────────────
export function useImpersonationSessions(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminImpersonation(filters),
    queryFn: () => adminApi.fetchImpersonationSessions(filters),
    ...options,
  })
}

export function useStartImpersonation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, reason }) => adminApi.startImpersonation(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'impersonation'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}

export function useEndImpersonation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: adminApi.endImpersonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'impersonation'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditLog() })
    },
  })
}
