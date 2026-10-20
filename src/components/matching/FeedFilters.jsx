/**
 * Discovery feed filters.
 *
 * These narrow an *already-legal* candidate set. The user's saved
 * preferences are deal-breakers the scorer applies first, so a filter
 * here can only remove people — it can never reveal someone their
 * preferences exclude. The UI says so, because otherwise a user who set
 * "women only" and then filters by "men" would see nothing and assume the
 * app is broken.
 *
 * The filter state is owned by the page, not by this component, because
 * it is also part of the React Query key — a filter change must produce a
 * new cache entry, and a second copy of the state here would drift.
 *
 * **Layout:** sort order is always visible as a pill row, because it is
 * the one control people reach for repeatedly; everything else lives
 * behind the disclosure. The controls that are sets of options — gender,
 * goal, interests — are pill rows rather than checkbox stacks: a pill row
 * reads as a tag cloud and scrolls sideways on a phone, where a vertical
 * checkbox list of twelve interests pushes the results off-screen.
 *
 * Each pill carries `aria-pressed`, and the selected style hangs off that
 * attribute rather than a parallel class, so the visual state and the
 * accessible state cannot disagree.
 */

import { RangeField } from '../ui/Form'
import { FEED_ORDERINGS, GENDERS, RELATIONSHIP_GOALS } from '../../utils/constants'

/**
 * A horizontally scrolling row of multi-select pills.
 *
 * `options` are `{value, label}` pairs. The values are toggled in and out
 * of an array, which is what the feed query takes.
 */
function PillGroup({ label, hint, options, value, onChange }) {
  const selectedValues = value ?? []

  const toggle = (optionValue) => {
    onChange(
      selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue)
        : [...selectedValues, optionValue],
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="label mb-0">{label}</p>
        {selectedValues.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="pill-row mt-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selectedValues.includes(option.value)}
            onClick={() => toggle(option.value)}
            className="pill"
          >
            {option.label}
          </button>
        ))}
      </div>

      {hint ? (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function FeedFilters({
  filters,
  onChange,
  onReset,
  interests = [],
  isOpen,
  onToggle,
}) {
  const update = (patch) => onChange({ ...filters, ...patch })

  const activeCount = [
    filters.minAge != null,
    filters.maxAge != null,
    filters.maxDistanceKm != null,
    filters.genders?.length,
    filters.goals?.length,
    filters.interests?.length,
    filters.minScore != null,
  ].filter(Boolean).length

  // Interests arrive from the API as `{id, name}`, so they are mapped to
  // the `{value, label}` shape `PillGroup` wants. The value stays the id,
  // which is what the feed query serialises.
  const interestOptions = interests.map((interest) => ({
    value: interest.id,
    label: interest.name,
  }))

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="feed-filter-panel"
          className={[
            'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5',
            'text-sm font-medium transition-all duration-fast ease-smooth',
            isOpen || activeCount > 0
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
              : 'border-sand-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-sand-700 dark:bg-sand-900 dark:text-slate-300',
          ].join(' ')}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Filters
          {activeCount > 0 ? (
            <span className="count-badge bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              {activeCount}
            </span>
          ) : null}
        </button>

        {/* Sort order, always visible: it is the control people change
            most often, and burying it behind a disclosure added a click
            to the most common interaction on the page. */}
        <div className="pill-row flex-1" role="group" aria-label="Sort order">
          {FEED_ORDERINGS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={(filters.ordering ?? 'score') === option.value}
              onClick={() => update({ ordering: option.value })}
              className="pill"
            >
              {option.label}
            </button>
          ))}
        </div>

        {activeCount > 0 ? (
          <button type="button" onClick={onReset} className="btn-ghost shrink-0 text-sm">
            Clear all
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          id="feed-filter-panel"
          className="animate-fade-in mt-3 space-y-5 rounded-2xl border border-sand-200 bg-white/70 p-4 backdrop-blur-sm dark:border-sand-800 dark:bg-sand-900/70"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <RangeField
              label="Minimum age"
              name="min-age"
              value={filters.minAge ?? 18}
              min={18}
              max={99}
              onChange={(event) => update({ minAge: Number(event.target.value) })}
            />
            <RangeField
              label="Maximum age"
              name="max-age"
              value={filters.maxAge ?? 99}
              min={18}
              max={99}
              onChange={(event) => update({ maxAge: Number(event.target.value) })}
            />
            <RangeField
              label="Maximum distance"
              name="max-distance"
              value={filters.maxDistanceKm ?? 100}
              min={1}
              max={500}
              step={5}
              formatValue={(value) => `${value} km`}
              onChange={(event) => update({ maxDistanceKm: Number(event.target.value) })}
              hint="People who hid their distance are always included."
            />
            <RangeField
              label="Minimum match score"
              name="min-score"
              value={filters.minScore ?? 0}
              min={0}
              max={100}
              step={5}
              formatValue={(value) => `${value}%`}
              onChange={(event) => update({ minScore: Number(event.target.value) })}
            />
          </div>

          <PillGroup
            label="Show me"
            options={GENDERS}
            value={filters.genders}
            onChange={(genders) => update({ genders })}
            hint="This narrows your saved preference — it cannot widen it."
          />

          <PillGroup
            label="Looking for"
            options={RELATIONSHIP_GOALS}
            value={filters.goals}
            onChange={(goals) => update({ goals })}
          />

          {interestOptions.length > 0 ? (
            <PillGroup
              label="Must share at least one of"
              options={interestOptions}
              value={filters.interests}
              onChange={(interests) => update({ interests })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
