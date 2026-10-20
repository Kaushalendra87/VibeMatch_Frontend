/**
 * Payments and refunds.
 *
 * **A refund is destructive and irreversible.** It moves real money, so
 * it is behind a confirmation dialog that is `dismissible={false}` while
 * the request is in flight, and it requires a reason that is recorded in
 * the audit log.
 *
 * The refund field takes a major-unit amount and converts once, the same
 * way the plan editor does. Leaving it blank refunds the remainder —
 * which is not the same as refunding zero, so the two are distinguished
 * in the UI rather than sharing an empty string.
 *
 * `is_refundable` comes from the server and accounts for the amount
 * already refunded. The button is disabled when it is false, and the
 * partial-refund state is shown rather than hidden, because "why can't I
 * refund this" is a question the screen should answer.
 */

import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { FormError, TextArea, TextField } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { useAdminPayments, useRefundPayment } from '../../hooks/useAdmin'
import { formatDate, formatDateTime } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially refunded' },
]

function statusTone(status) {
  return {
    succeeded: 'success',
    pending: 'info',
    failed: 'danger',
    refunded: 'neutral',
    partially_refunded: 'warning',
  }[status] ?? 'neutral'
}

export function AdminPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [refunding, setRefunding] = useState(null)
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') || ''

  const updateParams = useCallback(
    (patch) => {
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
    },
    [setSearchParams],
  )

  const { data, isLoading, isError, error, refetch } = useAdminPayments({ page, status })
  const refund = useRefundPayment()

  const openRefund = (payment) => {
    setRefunding(payment)
    // Pre-filled with the remaining refundable amount — the common case
    // is a full refund, and typing it out invites a typo.
    const remaining = payment.amount_minor - (payment.refunded_minor || 0)
    setAmountText(String(remaining / 100))
    setReason('')
    refund.reset()
  }

  const closeRefund = () => {
    setRefunding(null)
    setAmountText('')
    setReason('')
    setIsConfirmOpen(false)
  }

  const submitRefund = () => {
    const amountMajor = Number.parseFloat(amountText)
    const payload = {
      paymentId: refunding.id,
      reason: reason.trim(),
    }
    // Blank means "refund the rest", which the server treats as null —
    // not as zero.
    if (Number.isFinite(amountMajor)) {
      payload.amountMinor = Math.round(amountMajor * 100)
    }
    refund.mutate(payload, { onSuccess: closeRefund })
  }

  const remainingMinor = refunding
    ? refunding.amount_minor - (refunding.refunded_minor || 0)
    : 0

  const columns = [
    {
      key: 'user',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.user_name || row.user_email || `User ${row.user}`}
          </p>
          {row.user_email ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.user_email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {row.amount_display}
          </p>
          {row.refunded_minor > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {row.refunded_display} refunded
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display || row.status}</Badge>,
    },
    {
      key: 'description',
      header: 'For',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{row.description || '—'}</p>
          {row.card_last4 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.card_brand} ···· {row.card_last4}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'paid_at',
      header: 'Paid',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {row.paid_at ? formatDate(row.paid_at) : row.failed_at ? formatDate(row.failed_at) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => openRefund(row)}
          disabled={!row.is_refundable}
          title={row.is_refundable ? undefined : 'Already fully refunded.'}
        >
          Refund
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Charges, refunds and failures.">
        <div className="mt-4 lg:max-w-xs">
          <FilterSelect
            id="payment-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
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
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
        emptyTitle="No payments"
        emptyDescription="No charges have been recorded. Checkout is disabled until a payment provider is configured."
        caption="Payments"
      />

      <Modal
        isOpen={Boolean(refunding)}
        onClose={closeRefund}
        title="Refund a payment"
        description={
          refunding
            ? `${refunding.amount_display} from ${refunding.user_name || refunding.user_email}`
            : undefined
        }
        size="sm"
        dismissible={!refund.isPending}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeRefund}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setIsConfirmOpen(true)}
              disabled={!reason.trim() || refund.isPending}
            >
              Refund
            </button>
          </>
        }
      >
        {refunding ? (
          <div className="space-y-4">
            <TextField
              label="Amount to refund"
              name="refund_amount"
              type="number"
              value={amountText}
              onChange={setAmountText}
              hint={`Remaining refundable: ${refunding.amount_display} minus ${refunding.refunded_display} already refunded.`}
            />

            <TextArea
              label="Reason"
              name="refund_reason"
              value={reason}
              onChange={setReason}
              rows={3}
              required
              hint="Recorded in the audit log."
            />

            <FormError error={refund.error} />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={submitRefund}
        title="Confirm refund"
        description={`This returns money to the customer and cannot be undone. ${
          amountText ? `${amountText} will be refunded.` : 'The full remaining amount will be refunded.'
        }`}
        confirmLabel="Refund now"
        isDestructive
        isPending={refund.isPending}
      />

      {refunding && remainingMinor <= 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This payment has already been fully refunded.
        </p>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Checkout is disabled until a payment provider is configured, so no new
        charges are being created. Existing records are shown for reconciliation.
        Last checked {formatDateTime(new Date().toISOString())}.
      </p>
    </div>
  )
}
