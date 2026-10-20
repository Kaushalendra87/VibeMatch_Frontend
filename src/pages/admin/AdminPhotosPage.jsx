/**
 * The profile photo review queue.
 *
 * This page only has work to do while `auto_approve_photos` is **off**.
 * With it on, uploads are approved at creation and the queue is empty —
 * which looks exactly like a broken page, so the page reads the setting
 * and says which mode the site is in rather than leaving the moderator to
 * guess. That is the whole reason `useAdminSettings` is called here.
 *
 * Oldest first, matching the server's ordering for this endpoint. A
 * backlog should surface the person who has been waiting longest, not the
 * most recent upload.
 *
 * **Bulk decisions skip, they do not fail.** The queue refreshes between
 * page loads, so an id that is no longer pending is expected; the server
 * reports how many it actually decided and this page says so. Treating a
 * stale id as an error would make the moderator re-run the batch and hit
 * the "already decided" guard on the rows that worked.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader, Panel } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { FormError, TextArea } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import {
  useAdminPhotos,
  useAdminSettings,
  useDecidePhoto,
  useDecidePhotosBulk,
} from '../../hooks/useAdmin'
import { formatTimeAgo } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function statusTone(status) {
  return (
    {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
    }[status] ?? 'neutral'
  )
}

export function AdminPhotosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviewing, setReviewing] = useState(null)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkError, setBulkError] = useState(null)

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') ?? 'pending'

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

  const { data, isLoading, isError, error, refetch } = useAdminPhotos({ page, status })
  const { data: settings } = useAdminSettings()
  const decide = useDecidePhoto()
  const bulkDecide = useDecidePhotosBulk()

  const autoApprove = settings?.find((row) => row.key === 'auto_approve_photos')?.value

  const closeReview = () => {
    setReviewing(null)
    setReason('')
  }

  const submitDecision = (approve) => {
    decide.mutate(
      { photoId: reviewing.id, approve, reason: approve ? '' : reason.trim() },
      { onSuccess: closeReview },
    )
  }

  const toggleSelected = (id) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulk = (approve) => {
    setBulkError(null)
    if (!approve && !reason.trim()) {
      // Caught here as well as on the server so the moderator is not sent
      // on a round trip to be told something this page already knows.
      setBulkError({ detail: 'A rejection must explain why.' })
      return
    }
    bulkDecide.mutate(
      { ids: [...selected], approve, reason: approve ? '' : reason.trim() },
      {
        onSuccess: () => {
          setSelected(new Set())
          setReason('')
        },
        onError: (err) => setBulkError(err),
      },
    )
  }

  const columns = [
    {
      key: 'select',
      header: '',
      render: (row) =>
        row.moderation_status === 'pending' ? (
          <input
            type="checkbox"
            aria-label={`Select photo ${row.id}`}
            className="h-4 w-4 rounded border-slate-300"
            checked={selected.has(row.id)}
            onClick={(event) => {
              // The row opens the review modal; ticking the box must not.
              event.stopPropagation()
            }}
            onChange={() => toggleSelected(row.id)}
          />
        ) : null,
    },
    {
      key: 'image_url',
      header: 'Photo',
      render: (row) => (
        <img
          src={row.image_url}
          alt=""
          loading="lazy"
          className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        />
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.owner?.name || `User ${row.owner?.id}`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.owner?.email}</p>
          {row.owner?.photos_rejected > 0 ? (
            // One rejected upload is noise; a pattern is not, and the
            // moderator should see which this is before deciding.
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              {row.owner.photos_rejected} previously rejected
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'caption',
      header: 'Caption',
      render: (row) =>
        row.caption ? (
          <span className="line-clamp-2 max-w-xs">{row.caption}</span>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'moderation_status',
      header: 'Status',
      render: (row) => (
        <Badge tone={statusTone(row.moderation_status)}>{row.status_display}</Badge>
      ),
    },
    {
      key: 'moderation_reason',
      header: 'Reason',
      render: (row) =>
        row.moderation_reason ? (
          <span className="line-clamp-2 max-w-xs text-xs">{row.moderation_reason}</span>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Uploaded',
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
        row.moderation_status === 'pending' ? (
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

  const rows = data?.results ?? []
  const selectableRows = rows.filter((row) => row.moderation_status === 'pending')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Photos"
        description="Review uploaded profile photos. Oldest first."
      >
        {autoApprove === true ? (
          <div className="alert-warning mt-4">
            <strong className="font-semibold">Auto-approval is on.</strong> New
            photos are published without review, so this queue will stay empty.
            Turn off <code className="font-mono text-xs">auto_approve_photos</code> in
            Settings to review uploads before they appear.
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <FilterSelect
            id="photo-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
        </div>
      </PageHeader>

      {selected.size > 0 ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {selected.size} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={bulkDecide.isPending}
                onClick={() => runBulk(true)}
              >
                Approve selected
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={bulkDecide.isPending}
                onClick={() => setReviewing({ bulk: true })}
              >
                Reject selected…
              </button>
            </div>
          </div>
          {bulkError ? (
            <FormError error={bulkError} className="mt-3" />
          ) : null}
        </Panel>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        onRowClick={(row) =>
          row.moderation_status === 'pending' ? setReviewing(row) : undefined
        }
        emptyTitle={autoApprove ? 'Auto-approval is on' : 'Nothing to review'}
        emptyDescription={
          autoApprove
            ? 'Photos are published without review while auto_approve_photos is enabled.'
            : 'Every uploaded photo has been reviewed.'
        }
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
      />

      {status === 'pending' && selectableRows.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            id="select-all-photos"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={selectableRows.every((row) => selected.has(row.id))}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? new Set(selectableRows.map((row) => row.id))
                  : new Set(),
              )
            }
          />
          <label htmlFor="select-all-photos">Select every photo on this page</label>
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(reviewing)}
        onClose={closeReview}
        title={reviewing?.bulk ? 'Reject selected photos' : 'Review photo'}
        description={
          reviewing?.bulk
            ? 'The same reason is recorded against every photo in the batch.'
            : 'The owner is told why a photo was rejected.'
        }
      >
        {reviewing && !reviewing.bulk ? (
          <img
            src={reviewing.image_url}
            alt=""
            className="mb-4 max-h-80 w-full rounded-lg object-contain ring-1 ring-slate-200 dark:ring-slate-700"
          />
        ) : null}

        <TextArea
          id="photo-reason"
          label="Reason (required to reject)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Shown to the photo's owner."
          rows={3}
        />

        <FormError error={decide.error || bulkError} className="mt-3" />

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={closeReview}>
            Cancel
          </button>
          {reviewing?.bulk ? (
            <button
              type="button"
              className="btn-danger"
              disabled={bulkDecide.isPending}
              onClick={() => runBulk(false)}
            >
              Reject {selected.size}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-danger"
                disabled={decide.isPending}
                onClick={() => submitDecision(false)}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={decide.isPending}
                onClick={() => submitDecision(true)}
              >
                Approve
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
