/**
 * Daily trends and retention.
 *
 * **This page reads the rollup, not the live tables.** The figures here
 * span 7–90 days, which is what `DailyMetric` exists for — one indexed
 * range query instead of scanning the likes, messages, payments and
 * users tables on every page load. The trade is freshness: the rollup is
 * only as current as the last nightly job. That is why the Overview page
 * computes its numbers live and this one does not, and why nothing here
 * is labelled "today".
 *
 * **Missing days are gaps, not zeros.** `build_timeseries` omits a day
 * with no rollup row rather than zero-filling it, because a missing row
 * means the nightly job did not run — a different fact from "nothing
 * happened". Zero-filling would draw a crash to the baseline that never
 * occurred, so the chart is given exactly the points the server returned
 * and `connectNulls` is left off.
 *
 * Recharts renders SVG, so Tailwind's `dark:` variants do not reach it.
 * Axis and grid colours come from `useTheme()` instead.
 */

import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { DataTable, PageHeader, Panel, StatCard } from '../../components/admin/AdminUI'
import { SegmentedControl } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { useAdminCohorts, useAdminOverview, useAdminTimeseries } from '../../hooks/useAdmin'
import { useTheme } from '../../context/ThemeContext'
import { chartTheme } from '../../utils/chartTheme'
import { formatDate, formatMoney } from '../../utils/format'

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

/**
 * Axis tick style, themed by hand because SVG has no CSS cascade here.
 *
 * The values live in `utils/chartTheme` so this page and any future chart
 * resolve to the same palette — previously this object was inline, and
 * its `brand` series was a violet that had survived the rose rebrand
 * because nothing tied it to the tokens. See that module's header.
 */
function useChartTheme() {
  const { isDark } = useTheme()
  return chartTheme(isDark)
}

/** Short date for an axis tick — the full date does not fit. */
function tickDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function ChartFrame({ title, description, children, isEmpty, height = 280 }) {
  return (
    <Panel title={title} description={description}>
      {isEmpty ? (
        <EmptyState
          title="No data for this range"
          description="The daily rollup has no rows here yet. It is written by a nightly job, so a fresh install starts empty."
        />
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)
  const theme = useChartTheme()

  const overview = useAdminOverview()
  const timeseries = useAdminTimeseries(days)
  const cohorts = useAdminCohorts(8)

  const series = timeseries.data ?? []
  const isEmpty = !timeseries.isLoading && series.length === 0

  const cohortColumns = [
    {
      key: 'week',
      header: 'Cohort week',
      render: (row) => (
        <span className="whitespace-nowrap">
          {formatDate(row.week_start)} – {formatDate(row.week_end)}
        </span>
      ),
    },
    { key: 'cohort_size', header: 'Signed up', align: 'right' },
    { key: 'retained', header: 'Still active', align: 'right' },
    {
      key: 'retention_pct',
      header: 'Retention',
      align: 'right',
      render: (row) => {
        // Retention is colour-graded but the number is always shown, so
        // the colour is redundant rather than the only signal.
        const tone =
          row.retention_pct >= 60
            ? 'text-sage-600 dark:text-sage-400'
            : row.retention_pct >= 30
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
        return (
          <span className={`font-medium tabular-nums ${tone}`}>{row.retention_pct}%</span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Daily trends from the nightly rollup, and signup retention."
        actions={
          <SegmentedControl
            ariaLabel="Date range"
            value={days}
            onChange={setDays}
            options={RANGES}
          />
        }
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={overview.refetch} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="card p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-20" />
                </div>
              ))
            : [
                { label: 'Total users', value: overview.data?.total_users },
                { label: 'Active matches', value: overview.data?.active_matches },
                { label: 'Subscribers', value: overview.data?.subscribers },
                {
                  label: 'MRR',
                  value: formatMoney(overview.data?.mrr_minor ?? 0),
                  tone: 'success',
                },
              ].map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value ?? '—'}
                  tone={card.tone}
                />
              ))}
        </div>
      )}

      {timeseries.isError ? (
        <ErrorState error={timeseries.error} onRetry={timeseries.refetch} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title="New users"
              description="Signups per day."
              isEmpty={isEmpty}
              height={260}
            >
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="newUsersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.brand} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={theme.brand} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickDate}
                  stroke={theme.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke={theme.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={theme.tooltip}
                  labelFormatter={formatDate}
                  formatter={(value) => [value, 'New users']}
                />
                <Area
                  type="monotone"
                  dataKey="new_users"
                  stroke={theme.brand}
                  strokeWidth={2}
                  fill="url(#newUsersFill)"
                />
              </AreaChart>
            </ChartFrame>

            <ChartFrame
              title="Engagement"
              description="Likes, matches and messages per day."
              isEmpty={isEmpty}
              height={260}
            >
              <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickDate}
                  stroke={theme.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke={theme.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={theme.tooltip} labelFormatter={formatDate} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Line
                  type="monotone"
                  dataKey="likes_sent"
                  name="Likes"
                  stroke={theme.brand}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="matches_created"
                  name="Matches"
                  stroke={theme.success}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="messages_sent"
                  name="Messages"
                  stroke={theme.info}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartFrame>
          </div>

          <ChartFrame
            title="Revenue"
            description="Gross and net of refunds, in minor units."
            isEmpty={isEmpty}
            height={240}
          >
            <BarChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickDate}
                stroke={theme.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke={theme.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatMoney(value)}
              />
              <Tooltip
                contentStyle={theme.tooltip}
                labelFormatter={formatDate}
                formatter={(value, name) => [formatMoney(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="revenue_minor" name="Revenue" fill={theme.success} radius={[3, 3, 0, 0]} />
              <Bar dataKey="net_revenue_minor" name="Net" fill={theme.brand} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </>
      )}

      <section aria-labelledby="cohorts-heading">
        <h2
          id="cohorts-heading"
          className="heading-section mb-3"
        >
          Retention by signup week
        </h2>
        <DataTable
          columns={cohortColumns}
          rows={cohorts.data ?? []}
          isLoading={cohorts.isLoading}
          isError={cohorts.isError}
          error={cohorts.error}
          onRetry={cohorts.refetch}
          rowKey={(row) => row.week_start}
          emptyTitle="No cohorts yet"
          emptyDescription="A cohort appears once a full week of signups has passed."
          caption="Weekly signup cohorts and their retention"
        />
      </section>
    </div>
  )
}
