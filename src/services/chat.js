/**
 * Chat over HTTP.
 *
 * The WebSocket is the normal transport for sending and receiving — see
 * `hooks/useChatSocket.js`. Everything here is the HTTP half, which
 * exists for three jobs the socket cannot do:
 *
 * * **Image upload.** The multipart parser and the Pillow validators live
 *   on the HTTP side; the consumer explicitly refuses `kind: "image"`.
 * * **History.** Paged backwards from a cursor.
 * * **State changes.** Mute, archive, delete and read receipts are
 *   throttled and permission-checked writes, not socket frames.
 *
 * Sending text over HTTP is also supported, so a client that has lost its
 * socket can still deliver a message. It runs the identical service call
 * server-side, so validation and permission cannot diverge.
 */

import { api, unwrapPage } from './client'

/**
 * The chat list.
 *
 * Archived threads are hidden unless `archived` is true — the server
 * treats a missing parameter as false, so this only sends it to opt in.
 */
export async function fetchConversations({
  page = 1,
  pageSize,
  archived = false,
  unreadOnly = false,
} = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (archived) params.archived = true
  if (unreadOnly) params.unread = true
  const response = await api.get('/chat/conversations/', { params })
  return unwrapPage(response)
}

/**
 * Open the thread with a user, creating it on first contact.
 *
 * Addressed by **user id** (integer), not conversation id. Refused unless
 * the two have an active match, because a conversation row is addressable
 * by id and this is the only place a user can cause one to exist.
 */
export async function openConversation(userId) {
  const { data } = await api.post('/chat/conversations/create/', { user_id: userId })
  return data
}

export async function fetchConversation(conversationId) {
  const { data } = await api.get(`/chat/conversations/${conversationId}/`)
  return data
}

export async function toggleMute(conversationId) {
  const { data } = await api.post(`/chat/conversations/${conversationId}/mute/`)
  return data
}

export async function toggleArchive(conversationId) {
  const { data } = await api.post(`/chat/conversations/${conversationId}/archive/`)
  return data
}

/**
 * Thread history, oldest first within the page.
 *
 * Paged backwards with an opaque cursor rather than an offset: new
 * messages arriving while the user scrolls up would shift an offset
 * window and duplicate rows at the page boundary.
 *
 * `before` is opaque — pass back the `next_before` you were given. It
 * must be URL-encoded, since it contains a `|`.
 *
 * The response is **not** the standard pagination envelope:
 * `{results, has_more, next_before}`.
 */
export async function fetchMessages(conversationId, { before, limit = 30 } = {}) {
  const params = { limit }
  if (before) params.before = before
  const { data } = await api.get(`/chat/conversations/${conversationId}/messages/`, {
    params,
  })
  return {
    results: data.results ?? [],
    hasMore: data.has_more ?? false,
    nextBefore: data.next_before ?? null,
  }
}

/**
 * Send text over HTTP.
 *
 * `clientId` makes the send idempotent: the server keys on it, so a
 * retry after a timeout returns the original message rather than posting
 * a duplicate. The socket path uses the same field for the same reason.
 */
export async function sendMessage(conversationId, body, clientId) {
  const { data } = await api.post(
    `/chat/conversations/${conversationId}/messages/create/`,
    { body, kind: 'text', client_id: clientId },
  )
  return data
}

/**
 * Send an image. Multipart only.
 *
 * The server re-encodes the file to strip EXIF. That matters more here
 * than for a profile photo: a phone photo carries GPS coordinates, and
 * sending one in a chat would hand the recipient the sender's home
 * address.
 */
export async function sendImage(conversationId, file, caption = '', onProgress) {
  const form = new FormData()
  form.append('image', file)
  if (caption) form.append('caption', caption)

  const { data } = await api.post(
    `/chat/conversations/${conversationId}/messages/image/`,
    form,
    {
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    },
  )
  return data
}

/** Mark every message from the other participant as read. */
export async function markRead(conversationId) {
  const { data } = await api.post(`/chat/conversations/${conversationId}/read/`)
  return data
}

/** Drive the typing indicator without a socket. */
export async function sendTyping(conversationId, isTyping = true) {
  await api.post(`/chat/conversations/${conversationId}/typing/`, {
    is_typing: isTyping,
  })
}

/** Soft-delete one of your own messages. */
export async function deleteMessage(messageId) {
  await api.delete(`/chat/messages/${messageId}/`)
}

/** Total unread across every thread, for the nav badge. */
export async function fetchUnreadCount() {
  const { data } = await api.get('/chat/unread/')
  return data.unread_count ?? 0
}
