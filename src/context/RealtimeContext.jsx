/**
 * The two long-lived sockets, owned by the app rather than by a page.
 *
 * Both are mounted here for the same reason: a notification that arrives
 * while the user is on their profile page still has to light the bell, and
 * a message that arrives while they are on Discover still has to bump the
 * unread badge. A socket scoped to the chat page would miss both.
 *
 * **Fan-out.** Both sockets broadcast every frame to subscribers; the
 * chat page filters by `conversation_id` and the bell takes the count.
 * That is the trade the backend's one-group-per-user design makes — see
 * `chat/events.py` — and it is why the payloads carry ids rather than
 * relying on the client already knowing what it is looking at.
 *
 * Frames are dispatched through a ref-held listener set, not React state.
 * A message arriving ten times a second must not re-render every consumer
 * of this context; only the components that care about that specific
 * event update.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken } from '../services/client'
import { TAB_EVENT, publish, startTabBus, subscribeToTabBus } from '../services/tabBus'
import { ReconnectingSocket, SOCKET_STATE } from '../services/websocket'
import { useAuth } from './AuthContext'

const RealtimeContext = createContext(null)

/**
 * Which caches a domain event makes wrong.
 *
 * The mapping is explicit and lives here rather than at each call site
 * for the same reason `hooks/queryKeys.js` exists: an invalidation is
 * only correct if the key it uses is a structural prefix of the key the
 * fetch used, and a hand-typed array in a switch is where that drifts.
 *
 * Deliberately coarse. A new match touches the match list, the likes
 * tabs (a like-back is what created it) and the unread badge; a profile
 * change can touch any list that renders a person's card. Refetching a
 * little more than strictly necessary is cheap and always correct;
 * refetching too little is a stale row nobody can reproduce.
 */
const DOMAIN_EVENT_KEYS = {
  'match.created': [['matches'], ['likes'], ['notification-count'], ['unread-count']],
  'match.removed': [['matches'], ['conversations'], ['conversation']],
  'profile.updated': [
    ['matches'],
    // Both spellings, deliberately. React Query matches a key by comparing
    // elements, so `['conversation']` covers `['conversation', id]` (the
    // open thread's header avatar) and `['conversations']` covers the chat
    // *list* — they are different first elements, and one does not imply
    // the other. Omitting the singular left the avatar at the top of an
    // open conversation stale, which is the one place a user is most
    // likely to be looking when the other person changes their photo.
    ['conversations'],
    ['conversation'],
    ['likes'],
    ['feed'],
    ['public-profile'],
    ['my-viewers'],
  ],
}

export function RealtimeProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const [chatState, setChatState] = useState(SOCKET_STATE.CLOSED)
  const [notificationState, setNotificationState] = useState(SOCKET_STATE.CLOSED)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const chatSocketRef = useRef(null)
  const notificationSocketRef = useRef(null)

  /** Subscribers, keyed by event name. `'*'` receives everything. */
  const listenersRef = useRef(new Map())

  const emit = useCallback((frame) => {
    const listeners = listenersRef.current
    for (const handler of listeners.get(frame.event) ?? []) {
      try {
        handler(frame)
      } catch (err) {
        // One bad subscriber must not stop the others from being
        // notified — a throw here would swallow the whole frame.
        console.error('Realtime listener failed for', frame.event, err)
      }
    }
    for (const handler of listeners.get('*') ?? []) {
      try {
        handler(frame)
      } catch (err) {
        console.error('Realtime wildcard listener failed', err)
      }
    }
  }, [])

  /**
   * Subscribe to one event name, or `'*'` for everything.
   *
   * Returns an unsubscribe function so a component can clean up in its
   * effect teardown.
   */
  const subscribe = useCallback((event, handler) => {
    const listeners = listenersRef.current
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(handler)
    return () => {
      listeners.get(event)?.delete(handler)
    }
  }, [])

  /**
   * Apply a domain event to the cache, then hand it to subscribers.
   *
   * The invalidation comes first so a component that both subscribes and
   * reads a query sees the refetch already in flight, rather than
   * rendering the stale row for a frame and then correcting.
   */
  const handleDomainEvent = useCallback(
    (frame) => {
      const keys = DOMAIN_EVENT_KEYS[frame.event]
      if (keys) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key })
        }
      }
      emit(frame)
    },
    [emit, queryClient],
  )

  // ── Notification socket ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      notificationSocketRef.current?.close()
      notificationSocketRef.current = null
      setUnreadNotifications(0)
      return undefined
    }

    const socket = new ReconnectingSocket({
      path: '/ws/notifications/',
      // Read the token fresh on every attempt: a reconnect after a
      // refresh must use the new one, not the dead one captured at mount.
      getToken: getAccessToken,
      onStateChange: setNotificationState,
      onMessage: (frame) => {
        if (frame.event === 'ready' || frame.event === 'unread_count') {
          setUnreadNotifications(frame.unread_count ?? 0)
        }
        if (frame.event === 'notification.push') {
          // A new notification invalidates the list and the count. Let
          // React Query refetch rather than hand-patching the cache,
          // because the server also decides ordering and pagination.
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
        // Domain events ride this socket too — it is the one that is open
        // on every page for the whole session, so a match or a card
        // change reaches a user who is on Discover, not just one who has
        // the chat socket's page mounted. See `chat/events.py`.
        if (DOMAIN_EVENT_KEYS[frame.event]) {
          handleDomainEvent(frame)
          return
        }
        emit(frame)
      },
    })

    notificationSocketRef.current = socket
    socket.connect()
    return () => {
      socket.close()
      notificationSocketRef.current = null
    }
  }, [isAuthenticated, emit, handleDomainEvent, queryClient])

  // ── Cross-tab cache sync ───────────────────────────────────────────
  useEffect(() => {
    startTabBus()

    const unsubscribe = subscribeToTabBus((message) => {
      if (message.type === TAB_EVENT.DATA_INVALIDATED) {
        // Another tab mutated something. Its React Query cache and this
        // one's are separate objects with no shared memory, so the only
        // thing that can be shared is the *knowledge* that a key went
        // stale — which is exactly what the bus carries.
        for (const key of message.payload?.keys ?? []) {
          queryClient.invalidateQueries({ queryKey: key })
        }
      }
    })

    return unsubscribe
  }, [queryClient])

  // ── Chat socket ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      chatSocketRef.current?.close()
      chatSocketRef.current = null
      return undefined
    }

    const socket = new ReconnectingSocket({
      path: '/ws/chat/',
      getToken: getAccessToken,
      onStateChange: setChatState,
      onMessage: (frame) => {
        switch (frame.event) {
          case 'message':
            // Update the chat list's preview and unread badge without a
            // refetch. The open thread patches its own cache from the
            // same frame.
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            queryClient.invalidateQueries({ queryKey: ['unread-count'] })
            break
          case 'read':
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            break
          case 'conversation':
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            break
          default:
            break
        }
        emit(frame)
      },
    })

    chatSocketRef.current = socket
    socket.connect()
    return () => {
      socket.close()
      chatSocketRef.current = null
    }
  }, [isAuthenticated, emit, queryClient])

  const value = useMemo(
    () => ({
      subscribe,
      chatState,
      notificationState,
      unreadNotifications,
      setUnreadNotifications,
      /** Send a chat frame. Returns false if it was queued instead. */
      sendChat: (payload) => chatSocketRef.current?.send(payload) ?? false,
      isChatConnected: chatState === SOCKET_STATE.OPEN,
      /**
       * Invalidate a key here **and** in every other tab.
       *
       * A mutation's `onSuccess` only ever touches the tab that ran it.
       * Any hook that wants a change to be visible everywhere — a new
       * match, a profile edit, a like — calls this instead of
       * `queryClient.invalidateQueries` directly.
       */
      invalidateEverywhere: (keys) => {
        const list = Array.isArray(keys) ? keys : [keys]
        for (const key of list) {
          queryClient.invalidateQueries({ queryKey: key })
        }
        publish(TAB_EVENT.DATA_INVALIDATED, { keys: list })
      },
    }),
    [subscribe, chatState, notificationState, unreadNotifications, queryClient],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error('useRealtime must be used inside a RealtimeProvider')
  return context
}

/**
 * Subscribe to one socket event for the lifetime of a component.
 *
 * `handler` is held in a ref so an inline arrow function does not
 * resubscribe on every render — which would be a leak in a list of a
 * hundred message rows.
 */
export function useRealtimeEvent(event, handler) {
  const { subscribe } = useRealtime()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const stable = (frame) => handlerRef.current?.(frame)
    return subscribe(event, stable)
  }, [event, subscribe])
}
