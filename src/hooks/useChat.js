/**
 * Chat: the conversation list, message history, and the socket bridge.
 *
 * **The reconciliation problem.** A message can arrive twice — once as the
 * HTTP response to a send, once as a `message` frame on the socket, and
 * possibly a third time as the `ack` frame. All three carry the same
 * `client_id` (and after the first, the same server `id`), so dedup keys
 * on `client_id` first and `id` second. Without this the sender sees their
 * own message twice on a slow connection.
 *
 * **The ordering problem.** History is fetched newest-first from the
 * server and rendered oldest-first, while new messages append. The cache
 * therefore holds one array in chronological order, and `fetchNextPage`
 * prepends. React Query's infinite query does this cleanly, but the page
 * param is a cursor, not an offset.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import * as chatApi from '../services/chat'
import { newClientId } from '../services/websocket'
import { useRealtimeEvent } from '../context/RealtimeContext'
import { queryKeys } from './queryKeys'

// ── Conversation list ────────────────────────────────────────────────
export function useConversations(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.conversations(params),
    queryFn: () => chatApi.fetchConversations(params),
    // The socket invalidates this on every incoming message, so a short
    // staleTime would only add redundant requests.
    staleTime: 30 * 1000,
    ...options,
  })
}

export function useConversation(conversationId) {
  return useQuery({
    queryKey: queryKeys.conversation(conversationId),
    queryFn: () => chatApi.fetchConversation(conversationId),
    enabled: Boolean(conversationId),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: chatApi.fetchUnreadCount,
    staleTime: 30 * 1000,
  })
}

/** Open (or fetch) the thread with a user, addressed by user id. */
export function useOpenConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: chatApi.openConversation,
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        queryKeys.conversation(conversation.id),
        conversation,
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useToggleMute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: chatApi.toggleMute,
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        queryKeys.conversation(conversation.id),
        conversation,
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useToggleArchive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: chatApi.toggleArchive,
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        queryKeys.conversation(conversation.id),
        conversation,
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

// ── Message history ──────────────────────────────────────────────────
/**
 * Thread history, paged backwards with an opaque cursor.
 *
 * `getNextPageParam` returns the server's `nextBefore` string, which is
 * passed back verbatim. It is opaque on purpose — the wire format is
 * defined server-side, and reconstructing it here would break the moment
 * the cursor gained a component.
 *
 * The pages are flattened in reverse (oldest first) so the render is a
 * straight map.
 */
export function useMessages(conversationId) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) =>
      chatApi.fetchMessages(conversationId, { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextBefore : undefined,
    enabled: Boolean(conversationId),
    // A message the socket delivered is authoritative and already in the
    // cache; a refetch on mount would be a wasted round-trip that could
    // also reorder a just-sent message.
    staleTime: 60 * 1000,
  })
}

/**
 * Append one message into a conversation's cache, deduplicated.
 *
 * Exported because both the send mutation and the socket listener need
 * it, and they must agree exactly — the whole point is that a message
 * arriving by either route lands in the same slot.
 */
export function upsertMessage(queryClient, conversationId, message) {
  queryClient.setQueryData(queryKeys.messages(conversationId), (existing) => {
    if (!existing?.pages?.length) {
      // Nothing cached yet. Do not create a page from a single socket
      // frame — it would render one message and suppress the history
      // fetch, so the thread would look almost empty.
      return existing
    }

    // Pages are newest-first from the server, so the newest message lives
    // at the end of the last page.
    const pages = [...existing.pages]
    const lastIndex = pages.length - 1
    const lastPage = pages[lastIndex]
    const messages = [...lastPage.results]

    const index = messages.findIndex(
      (item) =>
        (message.client_id && item.client_id === message.client_id) ||
        item.id === message.id,
    )

    if (index !== -1) {
      // Already present — replace it. This is the path a send takes: the
      // optimistic entry is swapped for the server's, which carries the
      // real id and timestamp.
      messages[index] = { ...messages[index], ...message }
    } else {
      messages.push(message)
    }

    pages[lastIndex] = { ...lastPage, results: messages }
    return { ...existing, pages }
  })
}

/** Replace an optimistic message in place, keeping its position. */
function replaceMessage(queryClient, conversationId, clientId, replacement) {
  queryClient.setQueryData(queryKeys.messages(conversationId), (existing) => {
    if (!existing?.pages?.length) return existing
    const pages = existing.pages.map((page) => ({
      ...page,
      results: page.results.map((item) =>
        item.client_id === clientId ? { ...item, ...replacement } : item,
      ),
    }))
    return { ...existing, pages }
  })
}

/**
 * Send a message.
 *
 * Always over the socket when it is up, because that is the low-latency
 * path and the server broadcasts from the same service call. Falls back
 * to HTTP when the socket is down so a message is never silently lost.
 *
 * `clientId` is generated once per call and reused by the fallback, so a
 * retry cannot produce a duplicate.
 */
export function useSendMessage(conversationId, { sendFrame, isConnected }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ body, clientId }) => {
      const id = clientId || newClientId()
      if (isConnected && sendFrame) {
        // `send` returns false when it queued the frame instead of writing
        // it — the socket is mid-reconnect. That is still the socket path:
        // the frame goes out on open, and the server confirms with an
        // `ack`. Falling back to HTTP here would double-post.
        sendFrame({
          action: 'send',
          conversation_id: conversationId,
          body,
          client_id: id,
        })
        return { clientId: id, viaSocket: true }
      }
      const message = await chatApi.sendMessage(conversationId, body, id)
      return { clientId: id, viaSocket: false, message }
    },
    onSuccess: ({ viaSocket, message }) => {
      if (!viaSocket && message) {
        // The HTTP path has the server's message already; the socket path
        // waits for the ack frame, which `useChatSocket` handles.
        upsertMessage(queryClient, conversationId, message)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useSendImage(conversationId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, caption, onProgress }) =>
      chatApi.sendImage(conversationId, file, caption, onProgress),
    onSuccess: (message) => {
      // Images always go over HTTP — the multipart parser and the Pillow
      // validators live there, and the consumer refuses them explicitly.
      upsertMessage(queryClient, conversationId, message)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useDeleteMessage(conversationId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: chatApi.deleteMessage,
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData(
        queryKeys.messages(conversationId),
        (existing) => {
          if (!existing?.pages?.length) return existing
          const pages = existing.pages.map((page) => ({
            ...page,
            results: page.results.map((item) =>
              item.id === messageId
                ? { ...item, is_deleted: true, body: '' }
                : item,
            ),
          }))
          return { ...existing, pages }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

/**
 * Mark the thread read.
 *
 * Fire-and-forget, and deliberately not a mutation: it is called from an
 * effect on every render of an open thread, and a mutation's loading
 * state would flicker the UI on each one.
 */
export function useMarkRead(conversationId, { sendFrame, isConnected }) {
  const queryClient = useQueryClient()
  // The last id set we told the server about, so an effect that re-runs
  // on every render does not re-send the same receipt.
  const lastSent = useRef(null)

  return useCallback(
    (messageIds) => {
      if (!conversationId || !messageIds?.length) return

      // A stable signature for "the set of unread messages I have seen".
      const signature = `${messageIds.length}:${messageIds[messageIds.length - 1]}`
      if (lastSent.current === signature) return
      lastSent.current = signature

      if (isConnected && sendFrame) {
        sendFrame({ action: 'read', conversation_id: conversationId })
      } else {
        chatApi.markRead(conversationId).catch(() => {
          // A missed receipt is not worth surfacing; the next open
          // retries it.
        })
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() })
    },
    [conversationId, isConnected, sendFrame, queryClient],
  )
}

/**
 * Relay typing state over the socket.
 *
 * Returns a callback the composer calls on every keystroke. Throttling is
 * the composer's job — it knows when the user actually paused.
 */
export function useSendTyping(conversationId, { sendFrame, isConnected }) {
  return useCallback(
    (isTyping) => {
      if (!conversationId || !isConnected || !sendFrame) return
      sendFrame({
        action: 'typing',
        conversation_id: conversationId,
        is_typing: isTyping,
      })
    },
    [conversationId, isConnected, sendFrame],
  )
}

/**
 * Bridge the chat socket into the message caches.
 *
 * Mounted once by the chat page. Subscribes to the socket's fan-out and
 * routes each frame: `message` and `ack` upsert, `read` ticks the right
 * bubbles, `typing` and `presence` go to the component state the caller
 * owns.
 */
export function useChatSocket({
  conversationId,
  onTyping,
  onPresence,
  onRead,
} = {}) {
  const queryClient = useQueryClient()

  // `ack` is the sender's own message coming back with a server id —
  // upsert it so the optimistic entry is reconciled.
  useRealtimeEvent('ack', (frame) => {
    if (!frame.message) return
    upsertMessage(queryClient, frame.message.conversation_id, frame.message)
  })

  useRealtimeEvent('message', (frame) => {
    if (!frame.message) return
    const targetId = frame.message.conversation_id

    upsertMessage(queryClient, targetId, frame.message)

    // Only mark read if this thread is the one on screen. A message for
    // another thread must leave its unread badge alone.
    if (conversationId && targetId === conversationId) {
      // The caller's effect sends the receipt; this only refreshes the
      // list so the preview updates.
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  useRealtimeEvent('read', (frame) => {
    onRead?.(frame)
  })

  useRealtimeEvent('typing', (frame) => {
    onTyping?.(frame)
  })

  useRealtimeEvent('presence', (frame) => {
    onPresence?.(frame)
  })
}

/**
 * Fetch the next older page.
 *
 * Deliberately manual rather than auto-loading on scroll: a thread with
 * 5000 messages would otherwise walk backwards through all of them as the
 * user scrolls up, which is a lot of requests for messages nobody asked
 * for. The thread renders a "Load earlier messages" button instead.
 */
export function useLoadOlder({ hasNextPage, isFetchingNextPage, fetchNextPage }) {
  return useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
}

/**
 * Replace an optimistic message in place, keeping its position.
 *
 * Exported for the composer's rollback path: a send that fails must turn
 * the pending bubble into a "failed, tap to retry" one rather than
 * removing it, because a message that vanishes looks like a lost draft.
 */
export { replaceMessage }
