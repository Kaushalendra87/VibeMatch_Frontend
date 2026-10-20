/**
 * Chat — the conversation list, and the open thread beside it.
 *
 * One route serves both `/app/chat` and `/app/chat/:conversationId`, so on
 * a wide screen the list stays visible while a thread is open. On a narrow
 * screen the thread takes over and the list is reached by going back.
 *
 * **The socket is not owned here.** Both sockets are mounted at app level
 * (see `RealtimeContext`) so a message lights the nav badge from any page.
 * This page only *subscribes*: `useChatSocket` routes frames into the
 * message caches, and the handlers below track the two pieces of state
 * that are genuinely local — who is typing, and who is online.
 *
 * Read receipts are sent from an effect rather than from a click, because
 * "the thread is on screen" is the actual condition. `useMarkRead` holds
 * the last signature it sent so the effect re-running on every render does
 * not re-send the same receipt.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Avatar } from '../../components/ui/Avatar'
import { Badge, PresenceDot } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Composer } from '../../components/chat/Composer'
import { MessageList } from '../../components/chat/MessageList'
import { EmptyState, ErrorState, RowListSkeleton } from '../../components/ui/States'
import { Pagination } from '../../components/ui/Pagination'
import { LoadingState } from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { useRealtime, useRealtimeEvent } from '../../context/RealtimeContext'
import {
  useConversation,
  useConversations,
  useDeleteMessage,
  useLoadOlder,
  useMarkRead,
  useMessages,
  useSendImage,
  useSendMessage,
  useSendTyping,
  useToggleArchive,
  useToggleMute,
  upsertMessage,
} from '../../hooks/useChat'
import { newClientId } from '../../services/websocket'
import { formatRelative } from '../../utils/format'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../hooks/queryKeys'

// ── Conversation list ────────────────────────────────────────────────
function ConversationList({ activeId, onSelect, archived, onToggleArchived }) {
  const [page, setPage] = useState(1)
  const conversations = useConversations({ archived, page })

  const rows = conversations.data?.results ?? []

  // The page reset happens in the handler rather than in an effect on
  // `archived`. Page 3 of "active" is a nonsense position in "archived",
  // so the two have to change together — and doing it here means the
  // query key never renders once with the new filter and the old page.
  const toggleArchived = () => {
    setPage(1)
    onToggleArchived()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-sand-200 p-3 dark:border-sand-800">
        <h2 className="heading-section">
          Messages
        </h2>
        <button
          type="button"
          onClick={toggleArchived}
          aria-pressed={archived}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {archived ? 'Show active' : 'Show archived'}
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {conversations.isLoading ? (
          <RowListSkeleton count={6} />
        ) : conversations.isError ? (
          <ErrorState error={conversations.error} onRetry={conversations.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={archived ? 'Nothing archived' : 'No conversations yet'}
            description={
              archived
                ? 'Conversations you archive are kept here.'
                : 'Match with someone and start a conversation.'
            }
            action={
              archived ? null : (
                <Link to="/app/discover" className="btn-primary">
                  Discover people
                </Link>
              )
            }
          />
        ) : (
          <ul>
            {rows.map((conversation) => {
              const isActive = conversation.id === activeId
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    aria-current={isActive ? 'true' : undefined}
                    className={[
                      'flex w-full items-center gap-3 p-3 text-left transition-colors',
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    <Avatar
                      src={conversation.other_user?.photo}
                      name={conversation.other_user?.name}
                      size="md"
                      isOnline={conversation.other_user?.is_online}
                      showOnlineDot
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {conversation.other_user?.name ?? 'Unknown'}
                        </p>
                        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                          {formatRelative(conversation.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {conversation.last_message_preview || 'No messages yet'}
                        </p>
                        {conversation.unread_count > 0 ? (
                          <span className="count-badge shrink-0 bg-brand-600 text-white">
                            {conversation.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Pagination
        // The page we asked for, so the highlight cannot disagree with
        // the conversations it produced.
        page={page}
        totalPages={conversations.data?.totalPages ?? 1}
        onPageChange={setPage}
        className="border-t border-sand-200 p-2 dark:border-sand-800"
      />
    </div>
  )
}

// ── Open thread ──────────────────────────────────────────────────────
function Thread({ conversationId, onBack }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { sendChat, isChatConnected } = useRealtime()

  const conversation = useConversation(conversationId)
  const messages = useMessages(conversationId)

  const [typingUser, setTypingUser] = useState(null)
  const [presenceOverride, setPresenceOverride] = useState(null)
  const [failedIds, setFailedIds] = useState(() => new Set())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false)

  const sendMessage = useSendMessage(conversationId, {
    sendFrame: sendChat,
    isConnected: isChatConnected,
  })
  const sendImage = useSendImage(conversationId)
  const deleteMessage = useDeleteMessage(conversationId)
  const markRead = useMarkRead(conversationId, {
    sendFrame: sendChat,
    isConnected: isChatConnected,
  })
  const sendTyping = useSendTyping(conversationId, {
    sendFrame: sendChat,
    isConnected: isChatConnected,
  })
  const toggleMute = useToggleMute()
  const toggleArchive = useToggleArchive()

  const other = conversation.data?.other_user
  const isOnline = presenceOverride ?? other?.is_online ?? false

  // Flatten the pages into one chronological array. Pages arrive
  // newest-first, so the array is reversed before concatenation.
  const thread = useMemo(() => {
    const pages = messages.data?.pages ?? []
    return pages
      .slice()
      .reverse()
      .flatMap((page) => page.results)
  }, [messages.data])

  const loadOlder = useLoadOlder({
    hasNextPage: messages.hasNextPage,
    isFetchingNextPage: messages.isFetchingNextPage,
    fetchNextPage: messages.fetchNextPage,
  })

  // ── Socket subscriptions ───────────────────────────────────────────
  // `useRealtimeEvent` holds the handler in a ref, so these inline
  // closures do not resubscribe on every render.
  useRealtimeEvent('typing', (frame) => {
    if (frame.conversation_id !== conversationId) return
    // Ignore our own typing echo — the socket broadcasts to the whole
    // user group, and showing "you are typing" is nonsense.
    if (frame.user_id === user?.id) return
    setTypingUser(frame.is_typing ? (frame.user_name ?? 'Someone') : null)
  })

  useRealtimeEvent('presence', (frame) => {
    if (other && frame.user_id === other.id) {
      setPresenceOverride(frame.is_online)
    }
  })

  useRealtimeEvent('read', (frame) => {
    if (frame.conversation_id !== conversationId) return
    // Tick every message in the cache that the reader covered, rather
    // than refetching the thread to learn one boolean.
    queryClient.setQueryData(queryKeys.messages(conversationId), (existing) => {
      if (!existing?.pages?.length) return existing
      const ids = new Set(frame.message_ids ?? [])
      const pages = existing.pages.map((page) => ({
        ...page,
        results: page.results.map((item) =>
          ids.has(item.id) ? { ...item, is_read: true, read_at: frame.read_at } : item,
        ),
      }))
      return { ...existing, pages }
    })
  })

  // ── Read receipts ──────────────────────────────────────────────────
  // Every inbound message that is not ours is a candidate for a receipt.
  // `useMarkRead` dedupes by signature, so this running on every render
  // is cheap and cannot re-send.
  useEffect(() => {
    if (!user?.id || thread.length === 0) return
    const unreadIds = thread
      .filter((message) => message.sender_id !== user.id && !message.is_read)
      .map((message) => message.id)
    if (unreadIds.length > 0) markRead(unreadIds)
  }, [thread, user?.id, markRead])

  // ── Send ───────────────────────────────────────────────────────────
  const onSend = useCallback(
    async (body) => {
      const clientId = newClientId()
      const optimistic = {
        client_id: clientId,
        conversation_id: conversationId,
        sender_id: user?.id,
        body,
        kind: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        // No `id`: that is what marks this row as pending, and it clears
        // itself. `upsertMessage` merges the server's copy over this one,
        // and that copy has an id — so nothing has to unset a flag, and
        // there is no window where a delivered message still looks queued.
      }

      // Show it immediately. `upsertMessage` keys on `client_id`, so the
      // ack that follows replaces this row rather than adding a second.
      upsertMessage(queryClient, conversationId, optimistic)

      try {
        await sendMessage.mutateAsync({ body, clientId })
        setFailedIds((current) => {
          if (!current.has(clientId)) return current
          const next = new Set(current)
          next.delete(clientId)
          return next
        })
      } catch {
        setFailedIds((current) => new Set(current).add(clientId))
      }
    },
    [conversationId, user?.id, queryClient, sendMessage],
  )

  const onRetry = (message) => {
    // Drop the failed row and resend the text as a fresh message. Reusing
    // the client id would make the server treat it as a duplicate of the
    // send that just failed.
    queryClient.setQueryData(queryKeys.messages(conversationId), (existing) => {
      if (!existing?.pages?.length) return existing
      const pages = existing.pages.map((page) => ({
        ...page,
        results: page.results.filter((item) => item.client_id !== message.client_id),
      }))
      return { ...existing, pages }
    })
    setFailedIds((current) => {
      const next = new Set(current)
      next.delete(message.client_id)
      return next
    })
    onSend(message.body)
  }

  if (conversation.isLoading) return <LoadingState message="Opening conversation…" />
  if (conversation.isError) {
    return <ErrorState error={conversation.error} onRetry={conversation.refetch} />
  }

  const isMuted = conversation.data?.is_muted

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 border-b border-sand-200 p-3 dark:border-sand-800">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost shrink-0 p-2 lg:hidden"
          aria-label="Back to conversations"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
          </svg>
        </button>

        <Avatar
          src={other?.photo}
          name={other?.name}
          size="md"
          isOnline={isOnline}
          showOnlineDot
        />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {other?.name ?? 'Conversation'}
          </p>
          <div className="flex items-center gap-2">
            <PresenceDot isOnline={isOnline} showLabel />
            {/* The socket is reconnecting — say so rather than letting the
                user think their message was delivered. */}
            {!isChatConnected ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Reconnecting…
              </span>
            ) : null}
          </div>
        </div>

        {isMuted ? <Badge tone="neutral">Muted</Badge> : null}

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-label="Conversation options"
          className="btn-ghost shrink-0 p-2"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </header>

      {isMenuOpen ? (
        <div className="flex flex-wrap gap-2 border-b border-sand-200 bg-slate-50 p-2 dark:border-sand-800 dark:bg-slate-900/60">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              toggleMute.mutate(conversationId)
              setIsMenuOpen(false)
            }}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setIsArchiveConfirmOpen(true)
              setIsMenuOpen(false)
            }}
          >
            Archive
          </button>
          <Link to="/app/safety" className="btn-secondary text-sm">
            Report or block
          </Link>
        </div>
      ) : null}

      {/* ── Thread ─────────────────────────────────────────────── */}
      {messages.isLoading ? (
        <div className="flex-1">
          <RowListSkeleton count={5} />
        </div>
      ) : messages.isError ? (
        <div className="flex-1">
          <ErrorState error={messages.error} onRetry={messages.refetch} />
        </div>
      ) : (
        <MessageList
          messages={thread.map((message) =>
            // `_failed` is the one piece of send state that has to be
            // stored rather than derived: it means "the server refused
            // this and no ack is coming", which nothing in the message
            // itself can express.
            failedIds.has(message.client_id)
              ? { ...message, _failed: true }
              : message,
          )}
          currentUserId={user?.id}
          otherUser={other}
          onRetry={onRetry}
          onDelete={(message) => deleteMessage.mutate(message.id)}
          hasNextPage={messages.hasNextPage}
          isFetchingNextPage={messages.isFetchingNextPage}
          onLoadOlder={loadOlder}
          isTyping={Boolean(typingUser)}
        />
      )}

      <Composer
        onSend={onSend}
        onSendImage={(file, onProgress) => sendImage.mutateAsync({ file, onProgress })}
        onTyping={sendTyping}
      />

      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={() => {
          toggleArchive.mutate(conversationId, {
            onSettled: () => {
              setIsArchiveConfirmOpen(false)
              onBack()
            },
          })
        }}
        title="Archive this conversation?"
        description="It moves out of your main list and stops showing unread counts. The other person is not told, and you can unarchive it at any time."
        confirmLabel="Archive"
        isPending={toggleArchive.isPending}
      />
    </div>
  )
}

export function ChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [archived, setArchived] = useState(false)

  const openConversation = (conversation) => {
    navigate(`/app/chat/${conversation.id}`)
  }

  return (
    <div className="mx-auto max-w-wide">
      <h1 className="sr-only">Chat</h1>

      <div className="card flex h-[calc(100vh-9rem)] overflow-hidden">
        {/* The list is hidden on a narrow screen while a thread is open —
            two panes do not fit, and the thread is what was asked for. */}
        <div
          className={[
            'w-full shrink-0 border-r border-sand-200 dark:border-sand-800 lg:w-80',
            conversationId ? 'hidden lg:block' : 'block',
          ].join(' ')}
        >
          <ConversationList
            activeId={conversationId}
            onSelect={openConversation}
            archived={archived}
            onToggleArchived={() => setArchived((value) => !value)}
          />
        </div>

        <div className={conversationId ? 'flex-1' : 'hidden flex-1 lg:block'}>
          {conversationId ? (
            // `key` remounts the thread when switching conversations, so
            // the typing and presence state below cannot leak from one
            // person to the next.
            <Thread
              key={conversationId}
              conversationId={conversationId}
              onBack={() => navigate('/app/chat')}
            />
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose someone from the list to see your messages."
            />
          )}
        </div>
      </div>
    </div>
  )
}
