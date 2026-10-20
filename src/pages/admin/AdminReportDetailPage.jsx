/**
 * One report, and the decision form.
 *
 * **The decision form is a closed set of actions, not a free-text field.**
 * `action` is one of `none`, `warn`, `suspend`, `ban` or
 * `content_removed`; the server rejects anything else. Which one is
 * chosen determines what happens to a real person's account, so each
 * option carries a plain-language description of its consequence rather
 * than just its name.
 *
 * A `suspend` or `ban` requires a note. The server enforces it — this
 * page mirrors the requirement in the UI so the rejection is not a
 * surprise, but the enforcement is not here.
 *
 * Evidence URLs are signed and expiring. They are rendered as links that
 * open in a new tab; if one has expired it will 403, which is the
 * intended behaviour rather than a bug to work around.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DetailField, PageHeader, Panel } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { FormError, TextArea, TextField } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/Modal'
import { ErrorState, RowListSkeleton } from '../../components/ui/States'
import {
  useAdminReport,
  useClaimReport,
  useDecideReport,
} from '../../hooks/useAdmin'
import { formatDateTime, formatTimeAgo } from '../../utils/format'

/**
 * The actions a moderator can take, with what each one does.
 *
 * Ordered from least to most severe, which is also the order they should
 * be considered in — the least action that resolves the report is the
 * right one.
 */
const ACTIONS = [
  {
    value: 'none',
    label: 'No action — dismiss',
    description: 'Close the report without acting on the account.',
    isDestructive: false,
  },
  {
    value: 'warn',
    label: 'Warn the user',
    description: 'Send a warning. The account is not restricted.',
    isDestructive: false,
  },
  {
    value: 'content_removed',
    label: 'Remove the content',
    description: 'Take down the reported content. The account stays active.',
    isDestructive: false,
  },
  {
    value: 'suspend',
    label: 'Suspend the account',
    description:
      'Sign the user out and block sign-in for a set period. Reversible.',
    isDestructive: true,
  },
  {
    value: 'ban',
    label: 'Ban the account',
    description: 'Permanent. The user cannot sign in again.',
    isDestructive: true,
  },
]

const PRIORITY = {
  1: { label: 'Urgent', tone: 'danger' },
  2: { label: 'High', tone: 'warning' },
  3: { label: 'Normal', tone: 'info' },
  4: { label: 'Low', tone: 'neutral' },
  5: { label: 'Minimal', tone: 'neutral' },
}

function statusTone(status) {
  return {
    open: 'danger',
    in_review: 'warning',
    resolved: 'success',
    dismissed: 'neutral',
  }[status] ?? 'neutral'
}

export function AdminReportDetailPage() {
  const { reportId } = useParams()

  const { data: report, isLoading, isError, error, refetch } = useAdminReport(reportId)
  const claimReport = useClaimReport()
  const decideReport = useDecideReport()

  const [action, setAction] = useState('none')
  const [note, setNote] = useState('')
  const [suspendDays, setSuspendDays] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  if (isError) {
    return (
      <>
        <PageHeader title="Report" backTo="/admin/reports" backLabel="Queue" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Report" backTo="/admin/reports" backLabel="Queue" />
        <div className="card p-4">
          <RowListSkeleton count={5} />
        </div>
      </>
    )
  }

  const isClosed = report.status === 'resolved' || report.status === 'dismissed'
  const selectedAction = ACTIONS.find((entry) => entry.value === action)
  const needsNote = action === 'suspend' || action === 'ban'
  const canSubmit = !isClosed && (!needsNote || note.trim().length > 0)

  const submit = () => {
    const payload = { reportId: report.id, action, note: note.trim() }
    if (action === 'suspend' && suspendDays) payload.suspendDays = Number(suspendDays)
    decideReport.mutate(payload, {
      onSuccess: () => {
        setNote('')
        setSuspendDays('')
        setAction('none')
      },
    })
  }

  const onSubmit = () => {
    if (selectedAction?.isDestructive) {
      setIsConfirmOpen(true)
      return
    }
    submit()
  }

  const priorityMeta = PRIORITY[report.priority] ?? { label: String(report.priority), tone: 'neutral' }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Report against ${report.reported_user?.name || `user ${report.reported_user?.id}`}`}
        description={`${report.reason_display || report.reason} · filed ${formatTimeAgo(report.created_at)}`}
        backTo="/admin/reports"
        backLabel="Queue"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(report.status)}>{report.status_display}</Badge>
            <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="What was reported">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Reason" value={report.reason_display || report.reason} />
              <DetailField label="Filed" value={report.created_at} format={formatDateTime} />
              <DetailField label="Priority" value={priorityMeta.label} />
              <DetailField
                label="Assigned to"
                value={report.assigned_to_name || (report.assigned_to ? `User ${report.assigned_to}` : null)}
              />
            </dl>

            <div className="mt-4">
              <p className="eyebrow">
                Details
              </p>
              {report.details ? (
                // `whitespace-pre-wrap` because a report is free text and
                // collapsing its newlines can merge separate allegations
                // into one paragraph.
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {report.details}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">
                  No details were provided.
                </p>
              )}
            </div>

            {report.evidence_urls?.length ? (
              <div className="mt-4">
                <p className="eyebrow">
                  Evidence
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {report.evidence_urls.map((url, index) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="btn-secondary text-xs"
                      >
                        Attachment {index + 1}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Links are signed and expire. An expired link returns 403.
                </p>
              </div>
            ) : null}
          </Panel>

          {report.duplicate_count ? (
            <Panel
              title="Duplicate reports"
              description="Other reports of this user that were merged into this one."
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {report.duplicate_count}{' '}
                {report.duplicate_count === 1 ? 'report was' : 'reports were'} merged
                into this one. The decision below covers all of them.
              </p>
            </Panel>
          ) : null}

          {isClosed ? (
            <Panel title="Resolution">
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Action taken" value={report.action_display} />
                <DetailField label="Resolved" value={report.resolved_at} format={formatDateTime} />
                <DetailField label="Resolved by" value={report.resolved_by_name} />
              </dl>
              {report.resolution_note ? (
                <div className="mt-4">
                  <p className="eyebrow">
                    Note
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {report.resolution_note}
                  </p>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Reported user">
            <dl className="space-y-3">
              <DetailField label="Name" value={report.reported_user?.name} />
              <DetailField label="Email" value={report.reported_user?.email} />
              <DetailField
                label="Account status"
                value={report.reported_user?.status}
              />
              <DetailField
                label="Reports against"
                value={report.reported_user?.reports_against}
                format={(value) => (
                  <span className={value > 1 ? 'text-amber-600 dark:text-amber-400' : undefined}>
                    {value}
                  </span>
                )}
              />
              <DetailField
                label="Member since"
                value={report.reported_user?.member_since}
                format={formatDateTime}
              />
            </dl>

            {report.reported_user?.id ? (
              <Link
                to={`/admin/users/${report.reported_user.id}`}
                className="btn-secondary mt-4 w-full"
              >
                Open the account
              </Link>
            ) : null}
          </Panel>

          {!isClosed ? (
            <Panel
              title="Decision"
              description="This is recorded against your name in the audit log."
            >
              <div className="space-y-4">
                {!report.assigned_to ? (
                  <div>
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() => claimReport.mutate(report.id)}
                      disabled={claimReport.isPending}
                    >
                      {claimReport.isPending ? 'Claiming…' : 'Claim this report'}
                    </button>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Claiming tells other moderators you are handling it.
                    </p>
                  </div>
                ) : null}

                <fieldset>
                  <legend className="label">Action</legend>
                  <div className="space-y-2">
                    {ACTIONS.map((entry) => (
                      <label
                        key={entry.value}
                        className={[
                          'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                          action === entry.value
                            ? 'border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40'
                            : 'border-sand-200 hover:bg-sand-50 dark:border-sand-800 dark:hover:bg-sand-800/50',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="report-action"
                          value={entry.value}
                          checked={action === entry.value}
                          onChange={(event) => setAction(event.target.value)}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                            {entry.label}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {entry.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {action === 'suspend' ? (
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
                  label="Note"
                  name="resolution_note"
                  value={note}
                  onChange={setNote}
                  rows={3}
                  required={needsNote}
                  hint={
                    needsNote
                      ? 'Required. This is what the user is told, and what an appeal is answered from.'
                      : 'Optional. Stored with the decision.'
                  }
                />

                <FormError error={decideReport.error} />

                <button
                  type="button"
                  className={selectedAction?.isDestructive ? 'btn-danger w-full' : 'btn-primary w-full'}
                  onClick={onSubmit}
                  disabled={!canSubmit || decideReport.isPending}
                >
                  {decideReport.isPending ? 'Saving…' : selectedAction?.label || 'Submit decision'}
                </button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          submit()
          setIsConfirmOpen(false)
        }}
        title={action === 'ban' ? 'Ban this account?' : 'Suspend this account?'}
        description={
          action === 'ban'
            ? 'This is permanent. The user is signed out immediately and cannot sign in again.'
            : `The user is signed out immediately${
                suspendDays ? ` for ${suspendDays} day(s)` : ' for an indefinite period'
              }. They are notified of the reason.`
        }
        confirmLabel={action === 'ban' ? 'Ban account' : 'Suspend account'}
        isDestructive
        isPending={decideReport.isPending}
      />
    </div>
  )
}
