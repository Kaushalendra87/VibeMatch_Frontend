/**
 * A tab bar built on real buttons with the ARIA tab pattern.
 *
 * Keyboard support is arrow-key navigation, which is what the pattern
 * requires — Tab moves *out* of the tab list, not between tabs. Getting
 * this wrong is the most common accessibility defect in a tab bar, and it
 * is why this is a component rather than three `<button>`s at each call
 * site.
 */

import { useRef } from 'react'

export function Tabs({ tabs, value, onChange, className = '', ariaLabel = 'Tabs' }) {
  const listRef = useRef(null)

  const move = (delta) => {
    const index = tabs.findIndex((tab) => tab.value === value)
    if (index === -1) return
    // Wrap around, which is the expected behaviour for a tab list.
    const next = (index + delta + tabs.length) % tabs.length
    onChange(tabs[next].value)
    // Move focus too, or the next arrow key press starts from the old tab.
    listRef.current?.querySelectorAll('[role="tab"]')?.[next]?.focus()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(tabs[0].value)
      listRef.current?.querySelectorAll('[role="tab"]')?.[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(tabs[tabs.length - 1].value)
      listRef.current
        ?.querySelectorAll('[role="tab"]')
        ?.[tabs.length - 1]?.focus()
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex gap-1 overflow-x-auto border-b border-sand-200 dark:border-sand-800 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={isActive}
            // Only the active tab is reachable by Tab; arrows do the rest.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={[
              'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
            {tab.count != null ? (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            ) : null}
            {isActive ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600 dark:bg-brand-400" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** The panel for the active tab. Pairs with `Tabs`. */
export function TabPanel({ tabValue, value, children, className = '' }) {
  if (tabValue !== value) return null
  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * A pill-style toggle, for small mutually exclusive choices.
 *
 * Distinct from `Tabs` because these are form controls — they select a
 * value rather than switching a panel — so they use `radiogroup`
 * semantics instead of `tablist`.
 */
export function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
