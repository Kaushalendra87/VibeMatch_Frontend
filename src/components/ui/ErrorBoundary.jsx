/**
 * Catches render errors so a crash is a page, not a blank screen.
 *
 * React unmounts the whole tree when a render throws, which is why an
 * unhandled component error produces a white page with no clue in it.
 * A boundary turns that into something a user can act on and a developer
 * can find — and it is the only hook React gives for render errors, since
 * they never reach `window.onerror`.
 *
 * A class component because that is still the only way to be one:
 * `componentDidCatch` and `getDerivedStateFromError` have no hook
 * equivalent.
 *
 * **What this does not catch**, and cannot: errors thrown in event
 * handlers, in `setTimeout`, in a promise rejection, or in the boundary's
 * own render. Those are handled — or not — elsewhere; claiming otherwise
 * would be the usual lie told about error boundaries.
 */

import { Component } from 'react'

import { reportClientError } from '../../services/errors'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    // Render the fallback on the next pass. Deliberately does *not* report
    // here: this runs during the render phase, which React may invoke more
    // than once (StrictMode does, in development), and a reporter called
    // from it would file the same crash twice.
    return { error }
  }

  componentDidCatch(error, info) {
    // The commit phase, so exactly once per crash. `info.componentStack`
    // is the React component stack, which is the only part of this that
    // names *which* component broke.
    reportClientError({
      message: error?.message || String(error),
      stack: [error?.stack, info?.componentStack].filter(Boolean).join('\n\n'),
      component: this.props.name || 'ErrorBoundary',
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // Deliberately does not render the stack. It can contain values from
    // the user's own data, and a stack trace is for the developer who
    // reads it in the admin — not for the screen.
    return (
      <div
        role="alert"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <div className="text-red-500 dark:text-red-400" aria-hidden="true">
          <svg
            className="h-12 w-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
          </svg>
        </div>

        <h1 className="heading-section">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          This part of the page could not be displayed. The problem has been
          reported. Reloading usually clears it.
        </p>

        <button type="button" onClick={this.handleReload} className="btn-primary">
          Reload the page
        </button>
      </div>
    )
  }
}
