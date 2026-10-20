/**
 * The user table.
 *
 * Every filter here is a **server** query parameter, including the search
 * box. Filtering client-side over the current page would be worse than
 * useless on a table with 40,000 rows: it would search 20 of them and
 * present the result as if it were the answer.
 *
 * The URL is the source of truth for the filter state, so a filtered view
 * can be linked to a colleague or reloaded without losing the query. That
 * is why the state lives in `useSearchParams` rather than `useState`.
 *
 * `includeDeleted` is off by default and labelled clearly when on. A
 * soft-deleted user is invisible to `User.objects`, and an admin looking
 * for someone who "does not exist" is usually looking for exactly one of
 * those.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, PageHeader, SearchInput } from '../../components/admin/AdminUI'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, PresenceDot } from '../../components/ui/Badge'
import { ACCOUNT_STATUS, ROLES } from '../../utils/constants'
import { useAdminUsers } from '../../hooks/useAdmin'
import { formatDate, formatTimeAgo } from '../../utils/format'

const ROLE_OPTIONS = [
  { value: ROLES.USER, label: 'User' },
  { value: ROLES.MODERATOR, label: 'Moderator' },
  { value: ROLES.ADMIN, label: 'Admin' },
]

const STATUS_OPTIONS = [
  { value: ACCOUNT_STATUS.ACTIVE, label: 'Active' },
  { value: ACCOUNT_STATUS.SUSPENDED, label: 'Suspended' },
  { value: ACCOUNT_STATUS.BANNED, label: 'Banned' },
  { value: ACCOUNT_STATUS.DELETED, label: 'Deleted' },
]

const ORDERING_OPTIONS = [
  { value: '-date_joined', label: 'Newest first' },
  { value: 'date_joined', label: 'Oldest first' },
  { value: '-last_seen', label: 'Recently active' },
  { value: '-report_count', label: 'Most reported' },
]

/** Map the server's status value onto a badge tone. */
function statusTone(status) {
  return {
    [ACCOUNT_STATUS.ACTIVE]: 'success',
    [ACCOUNT_STATUS.SUSPENDED]: 'warning',
    [ACCOUNT_STATUS.BANNED]: 'danger',
    [ACCOUNT_STATUS.DELETED]: 'neutral',
  }[status] ?? 'neutral'
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // `q` is debounced into a separate piece of state so typing does not
  // fire a request per character. The other filters apply immediately —
  // a select is a deliberate single action.
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')

  const page = Number(searchParams.get('page') || 1)
  const q = searchParams.get('q') || ''
  const role = searchParams.get('role') || ''
  const status = searchParams.get('status') || ''
  const ordering = searchParams.get('ordering') || '-date_joined'
  const includeDeleted = searchParams.get('include_deleted') === '1'

  /** Merge a patch into the URL, resetting to page 1 unless paging. */
  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === '' || value == null || value === false) next.delete(key)
            else next.set(key, value === true ? '1' : String(value))
          }
          // Any change to the filters invalidates the current page number:
          // page 4 of the old result set may not exist in the new one.
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft !== q) updateParams({ q: searchDraft })
    }, 350)
    return () => clearTimeout(timer)
  }, [searchDraft, q, updateParams])

  const filters = { page, q, role, status, ordering, includeDeleted }
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers(filters)

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.photo} name={row.full_name || row.email} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
              {row.full_name || row.display_name || row.email}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge tone={row.role === ROLES.ADMIN ? 'brand' : 'neutral'}>
          {row.role_display}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(row.status)}>{row.status_display}</Badge>
          {row.is_verified ? <Badge tone="info">Verified</Badge> : null}
          {row.is_subscriber ? <Badge tone="success">{row.plan_name || 'Subscriber'}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      render: (row) => (
        <div className="flex items-center gap-2 text-xs">
          <PresenceDot isOnline={row.is_online} showLabel />
          <span className="text-slate-500 dark:text-slate-400">
            {row.last_seen ? formatTimeAgo(row.last_seen) : 'never'}
          </span>
        </div>
      ),
    },
    {
      key: 'report_count',
      header: 'Reports',
      align: 'right',
      render: (row) =>
        row.report_count ? (
          // Only coloured when non-zero — a table of grey zeros is noise.
          <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
            {row.report_count}
          </span>
        ) : (
          <span className="tabular-nums text-slate-400 dark:text-slate-600">0</span>
        ),
    },
    {
      key: 'date_joined',
      header: 'Joined',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDate(row.date_joined)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Search, filter and moderate accounts."
        actions={
          isFetching && !isLoading ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">Refreshing…</span>
          ) : null
        }
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <SearchInput
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder="Search by name, email or username…"
              label="Search users"
            />
          </div>
          <FilterSelect
            id="filter-role"
            label="Filter by role"
            value={role}
            onChange={(value) => updateParams({ role: value })}
            options={ROLE_OPTIONS}
            allLabel="All roles"
          />
          <FilterSelect
            id="filter-status"
            label="Filter by status"
            value={status}
            onChange={(value) => updateParams({ status: value })}
            options={STATUS_OPTIONS}
            allLabel="All statuses"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <FilterSelect
            id="filter-ordering"
            label="Sort order"
            value={ordering}
            onChange={(value) => updateParams({ ordering: value })}
            options={ORDERING_OPTIONS}
            allLabel="Default order"
          />

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => updateParams({ include_deleted: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
            Include deleted accounts
          </label>

          {q || role || status || ordering !== '-date_joined' || includeDeleted ? (
            <button
              type="button"
              onClick={() => {
                setSearchDraft('')
                setSearchParams({}, { replace: true })
              }}
              className="text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
        page={page}
        totalPages={data?.totalPages ?? 1}
        count={data?.count}
        onPageChange={(next) => updateParams({ page: next })}
        emptyTitle={q ? `No users match “${q}”` : 'No users found'}
        emptyDescription={
          q || role || status
            ? 'Try a different search term or clear the filters.'
            : 'No accounts exist yet.'
        }
        caption="All users, filtered"
      />

      {/* The rows are clickable but a table row is not focusable, so a
          keyboard user needs a real link per row. Rendered out of band
          rather than inside the row to keep the table markup valid. */}
      {data?.results?.length ? (
        <nav aria-label="User links" className="sr-only">
          <ul>
            {data.results.map((row) => (
              <li key={row.id}>
                <Link to={`/admin/users/${row.id}`}>
                  View {row.full_name || row.email}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
