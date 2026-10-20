/**
 * One user, with the actions an admin can take on them.
 *
 * Three things here are enforced by the server and are only *surfaced*
 * by this page, not implemented by it:
 *
 * * An admin cannot demote themselves. The role select is disabled with
 *   an explanation rather than hidden, so the rule is discoverable.
 * * The last admin cannot be demoted. This page cannot know how many
 *   admins exist, so it does not try — it lets the request through and
 *   shows the server's rejection.
 * * A suspension or ban revokes the user's tokens server-side.
 *
 * The confirmation dialog for a suspension or ban requires a reason and
 * is `dismissible={false}` while the request is in flight — a destructive
 * account action that can be dismissed mid-flight leaves the caller
 * unable to report what happened.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { DetailField, DataTable, PageHeader, Panel } from '../../components/admin/AdminUI'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, PresenceDot, VerifiedBadge } from '../../components/ui/Badge'
import { FormError, TextArea, TextField } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { ErrorState, RowListSkeleton } from '../../components/ui/States'
import { useAuth } from '../../context/AuthContext'
import {
  useAdminUser,
  useStartImpersonation,
  useUpdateAdminUser,
} from '../../hooks/useAdmin'
import { ACCOUNT_STATUS, ROLES } from '../../utils/constants'
import { formatDate, formatDateTime, formatTimeAgo } from '../../utils/format'

const ROLE_OPTIONS = [
  { value: ROLES.USER, label: 'User' },
  { value: ROLES.MODERATOR, label: 'Moderator' },
  { value: ROLES.ADMIN, label: 'Admin' },
]

const STATUS_OPTIONS = [
  { value: ACCOUNT_STATUS.ACTIVE, label: 'Active' },
  { value: ACCOUNT_STATUS.SUSPENDED, label: 'Suspended' },
  { value: ACCOUNT_STATUS.BANNED, label: 'Banned' },
]

function statusTone(status) {
  return {
    [ACCOUNT_STATUS.ACTIVE]: 'success',
    [ACCOUNT_STATUS.SUSPENDED]: 'warning',
    [ACCOUNT_STATUS.BANNED]: 'danger',
    [ACCOUNT_STATUS.DELETED]: 'neutral',
  }[status] ?? 'neutral'
}

export function AdminUserDetailPage() {
  const { userId } = useParams()
  const { user: currentUser, isAdmin } = useAuth()

  const { data: user, isLoading, isError, error, refetch } = useAdminUser(userId)
  const updateUser = useUpdateAdminUser()
  const startImpersonation = useStartImpersonation()

  const [roleDraft, setRoleDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [suspendDays, setSuspendDays] = useState('')

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isImpersonateOpen, setIsImpersonateOpen] = useState(false)
  const [impersonateReason, setImpersonateReason] = useState('')

  if (isError) {
    return (
      <>
        <PageHeader title="User" backTo="/admin/users" backLabel="All users" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="User" backTo="/admin/users" backLabel="All users" />
        <div className="card p-4">
          <RowListSkeleton count={5} />
        </div>
      </>
    )
  }

  const isSelf = currentUser?.id === user?.id
  // Only an admin may change a role, and never their own — a moderator
  // cannot promote themselves, and an admin cannot accidentally lock
  // themselves out.
  const canChangeRole = isAdmin && !isSelf

  const selectedRole = roleDraft || user.role
  const selectedStatus = statusDraft || user.status
  const isDestructiveStatus =
    selectedStatus === ACCOUNT_STATUS.SUSPENDED || selectedStatus === ACCOUNT_STATUS.BANNED

  const roleChanged = selectedRole !== user.role
  const statusChanged = selectedStatus !== user.status
  const noteChanged = noteDraft !== (user.moderation_note || '')
  const hasChanges = roleChanged || statusChanged || noteChanged

  const resetDrafts = () => {
    setRoleDraft('')
    setStatusDraft('')
    setNoteDraft('')
    setSuspendDays('')
  }

  const applyChanges = () => {
    const payload = {}
    if (roleChanged) payload.role = selectedRole
    if (statusChanged) payload.status = selectedStatus
    if (noteChanged) payload.moderation_note = noteDraft
    // Only meaningful for a suspension; the server rejects it otherwise.
    if (statusChanged && selectedStatus === ACCOUNT_STATUS.SUSPENDED && suspendDays) {
      payload.suspend_days = Number(suspendDays)
    }

    updateUser.mutate(
      { userId: user.id, ...payload },
      { onSuccess: resetDrafts },
    )
  }

  const onSaveClick = () => {
    if (isDestructiveStatus && statusChanged) {
      setIsConfirmOpen(true)
      return
    }
    applyChanges()
  }

  // For the `DataTable` below. These rows are already loaded as part of the
  // user payload rather than fetched as a page, so the table gets no
  // pagination — `onPageChange` is what `DataTable` keys that off.
  const columns = [
    { key: 'id', header: 'ID', render: (row) => row.id },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => row.reason_display || row.reason,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone="neutral">{row.status_display || row.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'When',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatTimeAgo(row.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={user.full_name || user.display_name || user.email}
        description={user.email}
        backTo="/admin/users"
        backLabel="All users"
        actions={
          isAdmin && !isSelf ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsImpersonateOpen(true)}
            >
              Impersonate
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Account">
            <div className="mb-4 flex items-center gap-3">
              <Avatar src={user.photo} name={user.full_name || user.email} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {user.full_name || user.display_name || user.email}
                  </p>
                  {user.is_verified ? <VerifiedBadge showLabel /> : null}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={statusTone(user.status)}>{user.status_display}</Badge>
                  <PresenceDot isOnline={user.is_online} showLabel />
                </div>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Role" value={user.role_display} />
              <DetailField label="Age" value={user.age} />
              <DetailField label="Joined" value={user.date_joined} format={formatDate} />
              <DetailField label="Last seen" value={user.last_seen} format={formatTimeAgo} />
              <DetailField label="Last login" value={user.last_login} format={formatDateTime} />
              <DetailField
                label="Email verified"
                value={user.email_verified ? 'Yes' : 'No'}
              />
              <DetailField
                label="Profile"
                value={user.profile_completeness != null ? `${user.profile_completeness}%` : null}
              />
              <DetailField label="Plan" value={user.plan_name} />
              <DetailField
                label="Reports against"
                value={user.report_count}
                format={(value) => (
                  <span className={value ? 'text-amber-600 dark:text-amber-400' : undefined}>
                    {value}
                  </span>
                )}
              />
              {user.suspended_until ? (
                <DetailField
                  label="Suspended until"
                  value={user.suspended_until}
                  format={formatDateTime}
                />
              ) : null}
            </dl>
          </Panel>

          <section aria-labelledby="recent-reports-heading">
            <h2 id="recent-reports-heading" className="heading-section mb-3">
              Recent reports
            </h2>
            <DataTable
              columns={columns}
              rows={user.recent_reports ?? []}
              rowKey={(row) => row.id}
              emptyTitle="No reports"
              emptyDescription="No reports have been filed against this account."
              caption="Reports filed against this user"
            />
          </section>

          <Panel
            title="Moderation history"
            description="Actions taken on this account."
          >
            {user.moderation_history?.length ? (
              <ul className="space-y-2">
                {user.moderation_history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-sand-800"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {entry.action_display || entry.action}
                      </p>
                      {entry.reason ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {entry.reason}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {formatTimeAgo(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No moderation actions have been taken on this account.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Moderation"
            description={
              isAdmin
                ? 'Changes are recorded in the audit log.'
                : 'A moderator may suspend or ban. Role changes need an administrator.'
            }
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="user-role" className="label">
                  Role
                </label>
                <select
                  id="user-role"
                  value={selectedRole}
                  onChange={(event) => setRoleDraft(event.target.value)}
                  disabled={!canChangeRole}
                  className="input"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isSelf ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    You cannot change your own role. Ask another administrator.
                  </p>
                ) : !isAdmin ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Only an administrator can change a role.
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="user-status" className="label">
                  Status
                </label>
                <select
                  id="user-status"
                  value={selectedStatus}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  className="input"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {statusChanged && selectedStatus === ACCOUNT_STATUS.SUSPENDED ? (
                <TextField
                  label="Suspension length (days)"
                  name="suspend_days"
                  type="number"
                  value={suspendDays}
                  onChange={setSuspendDays}
                  placeholder="e.g. 7"
                  hint="Leave blank for an indefinite suspension."
                />
              ) : null}

              <TextArea
                label="Moderation note"
                name="moderation_note"
                value={noteDraft || user.moderation_note || ''}
                onChange={setNoteDraft}
                rows={3}
                hint="Internal only. The user never sees this."
              />

              <FormError error={updateUser.error} />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onSaveClick}
                  disabled={!hasChanges || updateUser.isPending}
                >
                  {updateUser.isPending ? 'Saving…' : 'Save changes'}
                </button>
                {hasChanges ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={resetDrafts}
                    disabled={updateUser.isPending}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Identifiers">
            <dl className="space-y-3">
              <DetailField label="User ID" value={user.id} />
              <DetailField label="Username" value={user.username} />
              <DetailField
                label="Staff"
                value={user.is_staff ? 'Yes' : 'No'}
              />
              <DetailField
                label="Superuser"
                value={user.is_superuser ? 'Yes' : 'No'}
              />
            </dl>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          applyChanges()
          setIsConfirmOpen(false)
        }}
        title={
          selectedStatus === ACCOUNT_STATUS.BANNED
            ? 'Ban this account?'
            : 'Suspend this account?'
        }
        description={
          selectedStatus === ACCOUNT_STATUS.BANNED
            ? 'A ban is permanent and signs the user out immediately. They will not be able to sign back in.'
            : 'The user is signed out immediately and cannot sign back in until the suspension ends.'
        }
        confirmLabel={selectedStatus === ACCOUNT_STATUS.BANNED ? 'Ban account' : 'Suspend account'}
        isDestructive
        isPending={updateUser.isPending}
      />

      <Modal
        isOpen={isImpersonateOpen}
        onClose={() => {
          setIsImpersonateOpen(false)
          setImpersonateReason('')
        }}
        title="Impersonate this user"
        description="You will see the app as they see it. The session is logged and time-limited."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsImpersonateOpen(false)
                setImpersonateReason('')
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!impersonateReason.trim() || startImpersonation.isPending}
              onClick={() =>
                startImpersonation.mutate(
                  { userId: user.id, reason: impersonateReason.trim() },
                  {
                    onSuccess: () => {
                      setIsImpersonateOpen(false)
                      setImpersonateReason('')
                    },
                  },
                )
              }
            >
              {startImpersonation.isPending ? 'Starting…' : 'Start session'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A reason is required and is stored in the audit log alongside your
            name, the time, and your IP address.
          </p>
          <TextArea
            label="Reason"
            name="impersonate_reason"
            value={impersonateReason}
            onChange={setImpersonateReason}
            rows={3}
            required
            placeholder="e.g. Investigating a support ticket about a missing match"
          />
          <FormError error={startImpersonation.error} />
        </div>
      </Modal>
    </div>
  )
}
