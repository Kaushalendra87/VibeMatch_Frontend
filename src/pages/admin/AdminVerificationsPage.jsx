/**
 * The verification review queue.
 *
 * Oldest first, which is the server's ordering for this endpoint and the
 * only fair one — a queue that surfaces the newest submission leaves the
 * people who have been waiting longest at the bottom forever.
 *
 * **The selfie and ID URLs are signed and expiring.** They are rendered
 * as links rather than inline images on purpose: an ID document in a
 * table cell is visible to anyone who walks past the screen, and the
 * signature is what stops the URL being passed around later. A link
 * makes opening it a deliberate act.
 *
 * The decision is binary and a rejection requires a reason — the user is
 * told why, so "no" with no explanation is not an acceptable answer.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader, Panel } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { FormError, TextArea } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { useAdminVerifications, useDecideVerification } from '../../hooks/useAdmin'
import { formatTimeAgo } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const KIND_OPTIONS = [
  { value: 'photo', label: 'Photo' },
  { value: 'id', label: 'Government ID' },
]

function statusTone(status) {
  return {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
  }[status] ?? 'neutral'
}

export function AdminVerificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviewing, setReviewing] = useState(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') ?? 'pending'
  const kind = searchParams.get('kind') || ''

  const updateParams = (patch) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value === '' || value == null) next.delete(key)
          else next.set(key, String(value))
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const { data, isLoading, isError, error, refetch } = useAdminVerifications({
    page,
    status,
    kind,
  })
  const decide = useDecideVerification()

  const closeReview = () => {
    setReviewing(null)
    setReason('')
    setNotes('')
  }

  const submitDecision = (decision) => {
    decide.mutate(
      {
        requestId: reviewing.id,
        decision,
        reason: decision === 'rejected' ? reason.trim() : '',
        notes: notes.trim(),
      },
      { onSuccess: closeReview },
    )
  }

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.user_name || `User ${row.user}`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.user_email}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Type',
      render: (row) => <Badge tone="neutral">{row.kind_display}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display}</Badge>,
    },
    {
      key: 'pose_challenge',
      header: 'Pose',
      render: (row) =>
        row.pose_challenge ? (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
            {row.pose_challenge}
          </code>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'risk_score',
      header: 'Risk',
      align: 'right',
      render: (row) => {
        // The score is a heuristic hint, never the decision. It is shown
        // alongside everything else, not instead of it.
        const score = Number(row.risk_score ?? 0)
        const tone =
          score >= 0.7
            ? 'text-red-600 dark:text-red-400'
            : score >= 0.4
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-500 dark:text-slate-400'
        return <span className={`tabular-nums ${tone}`}>{score.toFixed(2)}</span>
      },
    },
    {
      key: 'created_at',
      header: 'Submitted',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatTimeAgo(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={(event) => {
              // The row is clickable; the button must not also trigger it.
              event.stopPropagation()
              setReviewing(row)
            }}
          >
            Review
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Verification"
        description="Review photo and ID submissions. Oldest first."
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="verification-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
          <FilterSelect
            id="verification-kind"
            label="Filter by type"
            value={kind}
            onChange={(value) => updateParams({ kind: value })}
            options={KIND_OPTIONS}
            allLabel="All types"
          />
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        onRowClick={(row) => (row.status === 'pending' ? setReviewing(row) : undefined)}
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
        emptyTitle={status === 'pending' ? 'Nothing waiting for review' : 'No submissions found'}
        emptyDescription={
          status === 'pending'
            ? 'Every submission has been reviewed. New ones appear here as they arrive.'
            : 'Try a different filter.'
        }
        caption="Verification submissions"
      />

      <Modal
        isOpen={Boolean(reviewing)}
        onClose={closeReview}
        title="Review submission"
        description={
          reviewing
            ? `${reviewing.user_name || `User ${reviewing.user}`} · ${reviewing.kind_display}`
            : undefined
        }
        size="lg"
        dismissible={!decide.isPending}
        footer={
          reviewing ? (
            <>
              <button
                type="button"
                className="btn-danger"
                onClick={() => submitDecision('rejected')}
                disabled={!reason.trim() || decide.isPending}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => submitDecision('approved')}
                disabled={decide.isPending}
              >
                {decide.isPending ? 'Saving…' : 'Approve'}
              </button>
            </>
          ) : null
        }
      >
        {reviewing ? (
          <div className="space-y-4">
            <Panel title="Submission">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="eyebrow">
                    Pose challenge
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
                    {reviewing.pose_challenge || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">
                    Risk score
                  </dt>
                  <dd className="mt-0.5 text-sm tabular-nums text-slate-800 dark:text-slate-200">
                    {Number(reviewing.risk_score ?? 0).toFixed(2)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {reviewing.selfie_url ? (
                  <a
                    href={reviewing.selfie_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-secondary text-xs"
                  >
                    Open selfie
                  </a>
                ) : null}
                {reviewing.id_document_url ? (
                  <a
                    href={reviewing.id_document_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-secondary text-xs"
                  >
                    Open ID document
                  </a>
                ) : null}
                {!reviewing.selfie_url && !reviewing.id_document_url ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No files are attached to this submission.
                  </p>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Links are signed and expire shortly. Check that the selfie matches
                the pose challenge and that the face matches the profile photos.
              </p>
            </Panel>

            <TextArea
              label="Rejection reason"
              name="rejection_reason"
              value={reason}
              onChange={setReason}
              rows={2}
              hint="Required to reject. The user is told this reason."
            />

            <TextArea
              label="Internal notes"
              name="reviewer_notes"
              value={notes}
              onChange={setNotes}
              rows={2}
              hint="Optional. Not shown to the user."
            />

            <FormError error={decide.error} />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
