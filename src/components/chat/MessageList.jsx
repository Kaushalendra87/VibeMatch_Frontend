/**
 * The message thread.
 *
 * Rendered oldest-first from a cache that is stored newest-first — the
 * server pages backwards, so `useMessages` reverses at the page boundary
 * and this component just maps.
 *
 * Three states a message row can be in, and they must be visually
 * distinct because they call for different user actions:
 *
 * * **Sending** — an optimistic row with no server id yet. Shown dimmed.
 * * **Failed** — the send rejected. Kept in place with a retry, because a
 *   message that silently vanishes reads as a lost draft.
 * * **Deleted** — soft-deleted server-side. The row survives as a tombstone
 *   so the surrounding conversation still makes sense.
 */

import { useEffect, useRef } from 'react'

import { Avatar } from '../ui/Avatar'
import { formatRelative } from '../../utils/format'

/** A day separator, inserted when the date changes between messages. */
function DayDivider({ date }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {date}
      </span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

function dayKey(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toDateString()
}

function MessageBubble({ message, onRetry, onDelete, isOwn }) {
  if (message.is_deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <p className="rounded-2xl bg-slate-100 px-3 py-2 text-sm italic text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          This message was deleted
        </p>
      </div>
    )
  }

  // Derived, not stored: a row with no server `id` has not been
  // acknowledged yet. See the optimistic entry in `ChatPage.onSend` —
  // the ack merges in an `id`, and this flips to false on its own.
  const isFailed = message._failed
  const isPending = !isFailed && !message.id

  return (
    <div className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {message.kind === 'image' && message.image_url ? (
          <a
            href={message.image_url}
            target="_blank"
            rel="noreferrer noopener"
            className="block overflow-hidden rounded-2xl border border-sand-200 dark:border-sand-800"
          >
            <img
              src={message.image_url}
              alt={message.body || 'Shared image'}
              width={message.image_width ?? undefined}
              height={message.image_height ?? undefined}
              loading="lazy"
              decoding="async"
              // The intrinsic dimensions are stored, so reserving the box
              // stops the thread jumping as images load in.
              className="max-h-80 w-auto object-cover"
            />
          </a>
        ) : (
          <div
            className={[
              'rounded-2xl px-3.5 py-2 text-sm',
              isFailed
                ? 'border border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                : isOwn
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
              isPending ? 'opacity-60' : '',
            ].join(' ')}
          >
            {/* `whitespace-pre-wrap` keeps the user's own line breaks but
                the text is rendered as text, never as markup. */}
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{formatRelative(message.created_at)}</span>

          {isFailed ? (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
            >
              Failed — retry
            </button>
          ) : null}

          {isPending && !isFailed ? <span>Sending…</span> : null}

          {/* Read receipts are only meaningful on your own messages — the
              other person reading their own message tells you nothing. */}
          {isOwn && !isPending && !isFailed && message.is_read ? (
            <span className="text-brand-500 dark:text-brand-400" title="Read">
              Read
            </span>
          ) : null}

          {isOwn && !isPending && !isFailed ? (
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
              aria-label="Delete message"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function MessageList({
  messages,
  currentUserId,
  onRetry,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  onLoadOlder,
  isTyping,
  otherUser,
}) {
  const bottomRef = useRef(null)
  // Only auto-scroll when the user is already at the bottom. Yanking them
  // down while they are reading history is the classic chat defect.
  const shouldStick = useRef(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight
      shouldStick.current = distance < 120
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (shouldStick.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages.length, isTyping])

  return (
    <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto p-4">
      {hasNextPage ? (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={isFetchingNextPage}
            className="btn-secondary text-sm"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
          </button>
        </div>
      ) : null}

      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No messages yet. Say hello.
        </p>
      ) : null}

      <div className="space-y-3">
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const showDivider = dayKey(message.created_at) !== dayKey(previous?.created_at)

          return (
            <div key={message.client_id || message.id}>
              {showDivider && message.created_at ? (
                <DayDivider
                  date={new Date(message.created_at).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                />
              ) : null}

              <MessageBubble
                message={message}
                isOwn={message.sender_id === currentUserId}
                onRetry={onRetry}
                onDelete={onDelete}
              />
            </div>
          )
        })}
      </div>

      {isTyping ? (
        <div className="mt-3 flex items-center gap-2">
          <Avatar src={otherUser?.photo} name={otherUser?.name} size="xs" />
          <span className="flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <span className="sr-only">{otherUser?.name} is typing</span>
            <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400" />
            <span
              className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400"
              style={{ animationDelay: '0.3s' }}
            />
          </span>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  )
}
