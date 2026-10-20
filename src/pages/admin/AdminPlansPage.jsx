/**
 * Plan management.
 *
 * **Prices are entered in major units and stored in minor.** The field
 * says "399" and the payload says `39900`. Doing the conversion in one
 * place — here — is what keeps `formatMoney`'s inverse exact; a stray
 * `* 100` somewhere else would produce a plan that costs 100× too much,
 * and the symptom (a wrong number in a checkout) is a bad one to find in
 * production.
 *
 * Deleting a plan is refused while subscribers exist, because
 * `Subscription.plan` is `PROTECT` — the delete would either raise or
 * orphan real subscriptions. The button is disabled with the count shown
 * rather than hidden, so the reason is visible.
 */

import { useState } from 'react'

import { DataTable, PageHeader, Panel } from '../../components/admin/AdminUI'
import { Badge } from '../../components/ui/Badge'
import { Checkbox, FormError, Select, TextArea, TextField } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { useAdminPlans, useDeletePlan, useSavePlan } from '../../hooks/useAdmin'

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
]

/** The entitlement toggles, with the plan field each one maps to. */
const ENTITLEMENTS = [
  { field: 'can_see_who_liked_you', label: 'See who liked you' },
  { field: 'can_rewind', label: 'Rewind last swipe' },
  { field: 'can_boost', label: 'Can boost' },
  { field: 'can_use_incognito', label: 'Incognito browsing' },
  { field: 'can_change_location', label: 'Change location' },
  { field: 'ad_free', label: 'Ad free' },
]

const EMPTY_PLAN = {
  name: '',
  slug: '',
  description: '',
  features: [],
  price_minor: 0,
  currency: 'INR',
  interval: 'month',
  daily_like_limit: 0,
  daily_super_like_limit: 0,
  boosts_per_month: 0,
  trial_days: 0,
  sort_order: 100,
  is_active: true,
  is_featured: false,
  can_see_who_liked_you: false,
  can_rewind: false,
  can_boost: false,
  can_use_incognito: false,
  can_change_location: false,
  ad_free: true,
}

export function AdminPlansPage() {
  const { data, isLoading, isError, error, refetch } = useAdminPlans()
  const savePlan = useSavePlan()
  const deletePlan = useDeletePlan()

  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [featuresText, setFeaturesText] = useState('')
  // Held as a string so a half-typed "39." does not round-trip through a
  // number and lose the decimal point under the cursor.
  const [priceText, setPriceText] = useState('')

  const openEditor = (plan) => {
    setEditing(plan ?? { ...EMPTY_PLAN })
    setFeaturesText((plan?.features ?? []).join('\n'))
    setPriceText(plan ? String(plan.price_minor / 100) : '')
    savePlan.reset()
  }

  const closeEditor = () => {
    setEditing(null)
    setFeaturesText('')
    setPriceText('')
  }

  const updateField = (field, value) => {
    setEditing((previous) => ({ ...previous, [field]: value }))
  }

  const onSubmit = () => {
    const priceMajor = Number.parseFloat(priceText || '0')
    const payload = {
      ...editing,
      // Major → minor, once, here. `Math.round` because 399.99 * 100 is
      // 39998.999… in binary floating point.
      price_minor: Number.isFinite(priceMajor) ? Math.round(priceMajor * 100) : 0,
      features: featuresText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }
    delete payload.subscriber_count
    delete payload.price_display
    delete payload.compare_at_price_display
    delete payload.interval_display

    savePlan.mutate(
      { planId: editing.id, ...payload },
      { onSuccess: closeEditor },
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Plan',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
            {row.is_featured ? <Badge tone="brand">Featured</Badge> : null}
            {!row.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
          </div>
          <code className="text-xs text-slate-500 dark:text-slate-400">{row.slug}</code>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (row) => (
        <div className="whitespace-nowrap">
          <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {row.price_display}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {' '}
            / {row.interval_display}
          </span>
          {row.compare_at_price_display ? (
            <p className="text-xs text-slate-400 line-through dark:text-slate-600">
              {row.compare_at_price_display}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.daily_like_limit === 0 ? 'Unlimited likes' : `${row.daily_like_limit} likes/day`}
          {' · '}
          {row.daily_super_like_limit === 0
            ? 'no super likes'
            : `${row.daily_super_like_limit} super/day`}
        </span>
      ),
    },
    {
      key: 'subscriber_count',
      header: 'Subscribers',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-300">
          {row.subscriber_count ?? 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => openEditor(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setDeleting(row)}
            disabled={row.subscriber_count > 0}
            title={
              row.subscriber_count > 0
                ? 'Cannot delete a plan with subscribers. Deactivate it instead.'
                : undefined
            }
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plans"
        description="What is for sale, and what each tier unlocks."
        actions={
          <button type="button" className="btn-primary" onClick={() => openEditor(null)}>
            New plan
          </button>
        }
      />

      {savePlan.isError && !editing ? <FormError error={savePlan.error} /> : null}

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        emptyTitle="No plans yet"
        emptyDescription="Create a plan to give users something to subscribe to."
        emptyAction={
          <button type="button" className="btn-primary" onClick={() => openEditor(null)}>
            Create the first plan
          </button>
        }
        caption="Subscription plans"
      />

      <Modal
        isOpen={Boolean(editing)}
        onClose={closeEditor}
        title={editing?.id ? `Edit ${editing.name}` : 'New plan'}
        size="lg"
        dismissible={!savePlan.isPending}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeEditor}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onSubmit}
              disabled={!editing?.name?.trim() || !editing?.slug?.trim() || savePlan.isPending}
            >
              {savePlan.isPending ? 'Saving…' : editing?.id ? 'Save plan' : 'Create plan'}
            </button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Name"
                name="plan-name"
                value={editing.name}
                onChange={(value) => updateField('name', value)}
                required
                placeholder="Plus"
              />
              <TextField
                label="Slug"
                name="plan-slug"
                value={editing.slug}
                onChange={(value) => updateField('slug', value)}
                required
                hint="Lowercase, used in URLs and the API."
                placeholder="plus"
              />
            </div>

            <TextArea
              label="Description"
              name="plan-description"
              value={editing.description}
              onChange={(value) => updateField('description', value)}
              rows={2}
            />

            <TextArea
              label="Features"
              name="plan-features"
              value={featuresText}
              onChange={setFeaturesText}
              rows={4}
              hint="One per line. Shown on the pricing page."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Price"
                name="plan-price"
                type="number"
                value={priceText}
                onChange={setPriceText}
                hint="In major units — 399 becomes ₹399."
              />
              <Select
                label="Interval"
                name="plan-interval"
                value={editing.interval}
                onChange={(value) => updateField('interval', value)}
                options={INTERVAL_OPTIONS}
              />
              <TextField
                label="Sort order"
                name="plan-sort"
                type="number"
                value={editing.sort_order}
                onChange={(value) => updateField('sort_order', Number(value))}
                hint="Lower shows first."
              />
            </div>

            <fieldset>
              <legend className="label">Limits</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Likes per day"
                  name="plan-likes"
                  type="number"
                  value={editing.daily_like_limit}
                  onChange={(value) => updateField('daily_like_limit', Number(value))}
                  hint="0 means unlimited."
                />
                <TextField
                  label="Super likes per day"
                  name="plan-super"
                  type="number"
                  value={editing.daily_super_like_limit}
                  onChange={(value) => updateField('daily_super_like_limit', Number(value))}
                  hint="0 means unlimited."
                />
                <TextField
                  label="Trial days"
                  name="plan-trial"
                  type="number"
                  value={editing.trial_days}
                  onChange={(value) => updateField('trial_days', Number(value))}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">Entitlements</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ENTITLEMENTS.map((entry) => (
                  <Checkbox
                    key={entry.field}
                    label={entry.label}
                    name={entry.field}
                    checked={Boolean(editing[entry.field])}
                    onChange={(checked) => updateField(entry.field, checked)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-4">
              <Checkbox
                label="Active (visible for sale)"
                name="plan-active"
                checked={Boolean(editing.is_active)}
                onChange={(checked) => updateField('is_active', checked)}
              />
              <Checkbox
                label="Featured"
                name="plan-featured"
                checked={Boolean(editing.is_featured)}
                onChange={(checked) => updateField('is_featured', checked)}
              />
            </div>

            <FormError error={savePlan.error} />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deletePlan.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        title={`Delete ${deleting?.name}?`}
        description="This cannot be undone. Existing subscriptions would be orphaned, which is why a plan with subscribers cannot be deleted — deactivate it instead."
        confirmLabel="Delete plan"
        isDestructive
        isPending={deletePlan.isPending}
      />

      {deletePlan.isError ? (
        <Panel title="Could not delete">
          <FormError error={deletePlan.error} />
        </Panel>
      ) : null}
    </div>
  )
}
