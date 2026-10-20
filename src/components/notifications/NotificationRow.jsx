/**
 * One notification, as a row.
 *
 * Extracted from the bell's dropdown so the full page and the dropdown
 * render the *same* row. They show the same records from the same
 * endpoint, and two copies of this markup would drift — the unread tint
 * and the kind icon would end up subtly different depending on where you
 * happened to be looking.
 *
 * The row is a `<Link>` to `action_url`, which the server supplies. When
 * it is absent the row still renders but is not interactive — a link to
 * nowhere is worse than plain text.
 */

import { Link } from 'react-router-dom'

import { Avatar } from '../ui/Avatar'
import { formatTimeAgo } from '../../utils/format'

/** An icon per notification kind, so the list scans without reading. */
export function KindIcon({ kind }) {
  const common = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.7',
    'aria-hidden': true,
  }

  switch (kind) {
    case 'new_match':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21 4.2 13.2a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5L12 21Z"
          />
        </svg>
      )
    case 'new_like':
    case 'super_like':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.5 20.5 4.6 13.6a4.4 4.4 0 0 1 6.2-6.2l.7.7.7-.7a4.4 4.4 0 0 1 6.2 6.2l-6.9 6.9Z"
          />
        </svg>
      )
    case 'new_message':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z"
          />
        </svg>
      )
    case 'profile_view':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'verification_approved':
    case 'verification_rejected':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.5 11 14.5 15.5 10M12 2.5 4 6v6c0 5 3.4 8.5 8 9.5 4.6-1 8-4.5 8-9.5V6l-8-3.5Z"
          />
        </svg>
      )
    case 'subscription':
    case 'payment':
      return (
        <svg {...common}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
          <path strokeLinecap="round" d="M2.5 10h19" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1" />
        </svg>
      )
  }
}

export function NotificationRow({ notification, onNavigate }) {
  const body = (
    <>
      {notification.actor ? (
        <Avatar
          src={notification.actor.photo}
          name={notification.actor.name}
          size="sm"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-100 text-slate-500 dark:bg-sand-800 dark:text-slate-400">
          <KindIcon kind={notification.kind} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {notification.title}
        </p>
        {notification.body ? (
          <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {notification.body}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>

      {!notification.is_read ? (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
          aria-label="Unread"
        />
      ) : null}
    </>
  )

  const className = [
    'flex gap-3 px-4 py-3 transition-colors',
    notification.action_url
      ? 'hover:bg-sand-50 dark:hover:bg-sand-800/60'
      : '',
    notification.is_read ? '' : 'bg-brand-50/50 dark:bg-brand-950/20',
  ].join(' ')

  // No destination: render the same row as plain content rather than a
  // link that goes nowhere.
  if (!notification.action_url) {
    return <div className={className}>{body}</div>
  }

  return (
    <Link to={notification.action_url} onClick={onNavigate} className={className}>
      {body}
    </Link>
  )
}
