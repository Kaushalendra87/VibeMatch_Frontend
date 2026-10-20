/**
 * "This part of the API does not exist yet."
 *
 * Four sections of the product are specified but not yet backed by an
 * endpoint: notifications, billing, moderation and the admin panel. Their
 * Django models are real and substantial, but the apps still ship
 * `urlpatterns = []`.
 *
 * Rendering a working-looking screen against a 404 is worse than useless —
 * the user fills in a report form and it silently fails, or taps Upgrade
 * and nothing happens. So those sections render this instead: what the
 * feature will do, and what is actually true right now.
 *
 * It takes a `title` and `description` so each call site can be specific
 * about which piece is missing and what still works in the meantime.
 */

export function ComingSoon({ title, description, items, action, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/50 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 8v5m0 3h.01" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="heading-section">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>

          {items?.length ? (
            <ul className="mt-3 space-y-1.5">
              {items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
