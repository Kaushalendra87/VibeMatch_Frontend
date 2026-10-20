/**
 * Display formatting.
 *
 * Every date that arrives from the API is an ISO 8601 string in UTC. It
 * is parsed here and rendered in the viewer's locale — never sent back in
 * that form. Writes send ISO strings, which is what DRF expects.
 */

/** Parse an API timestamp, tolerating `null` and unparseable input. */
export function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "12 Mar 2026" */
export function formatDate(value) {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "12 Mar 2026, 14:30" */
export function formatDateTime(value) {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Chat-list timestamp: time today, weekday this week, date beyond that.
 * A single fixed format would either be uselessly precise for an old
 * thread or uselessly vague for a live one.
 */
export function formatRelative(value) {
  const date = parseDate(value)
  if (!date) return ''

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (date >= startOfYesterday) return 'Yesterday'

  const daysAgo = (startOfToday - date) / 86_400_000
  if (daysAgo < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return formatDate(value)
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function formatTimeAgo(value) {
  const date = parseDate(value)
  if (!date) return ''

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`
  return formatDate(value)
}

/** Minutes since a timestamp — used to decide whether a dot is still lit. */
export function minutesSince(value) {
  const date = parseDate(value)
  if (!date) return Infinity
  return (Date.now() - date.getTime()) / 60_000
}

/**
 * Money is stored in integer minor units so no rounding error can
 * accumulate. This is the only place it becomes a decimal string.
 *
 * `Intl` with `style: 'currency'` handles the symbol and the placement,
 * which differ per currency and are not something to hand-roll.
 */
export function formatMoney(amountMinor, currency = 'INR') {
  if (amountMinor == null) return ''
  const amount = Number(amountMinor) / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    // An unrecognised currency code throws. Fall back to something
    // readable rather than crashing the billing page.
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Truncate to a whole number of words, for card previews. */
export function truncate(text, max = 120) {
  const value = (text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, value.lastIndexOf(' ', max)) || value.slice(0, max)}…`
}

/** Initials for an avatar fallback when a user has no photo. */
export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "5 ft 7 in (170 cm)" — height is stored in cm. */
export function formatHeight(cm) {
  if (!cm) return ''
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}′ ${inches}″ (${cm} cm)`
}

/** "Today", "1 Jan – 7 Jan" etc. for date-range filter labels. */
export function formatDateRange(start, end) {
  const from = formatDate(start)
  const to = formatDate(end)
  if (!from && !to) return ''
  if (!to) return `From ${from}`
  if (!from) return `Until ${to}`
  return `${from} – ${to}`
}

/** ISO date (no time) for a date input's value. */
export function toDateInputValue(value) {
  const date = parseDate(value)
  if (!date) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/** Whole years between a birth date and today. */
export function ageFromDateOfBirth(value) {
  const date = parseDate(value)
  if (!date) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }
  return age
}
