import { describe, expect, it } from 'vitest'

import { buildUrl } from './websocket'

/**
 * `buildUrl` decides which origin the chat and notification sockets dial.
 *
 * The default (no `VITE_WS_URL`) has to stay same-origin: the Vite dev
 * proxy and any single-origin deployment depend on it, and a regression
 * there would send development traffic to a host that does not exist.
 *
 * The override exists for one specific deployment shape — a host that
 * proxies HTTP but not the WebSocket upgrade (Vercel rewrites to an
 * external origin), where the socket must reach the backend directly.
 */
describe('buildUrl', () => {
  describe('without VITE_WS_URL', () => {
    it('uses the page origin over https', () => {
      // jsdom defaults to http://localhost:3000 in this setup; the origin is
      // read at call time, so it is asserted rather than hard-coded.
      expect(buildUrl('/ws/chat/', '')).toBe(
        `ws://${window.location.host}/ws/chat/`,
      )
    })

    it('preserves the path it is given', () => {
      expect(buildUrl('/ws/notifications/', '')).toBe(
        `ws://${window.location.host}/ws/notifications/`,
      )
    })
  })

  describe('with an https base', () => {
    it('upgrades https to wss and keeps the path', () => {
      expect(buildUrl('/ws/chat/', 'https://vibematch-api.onrender.com')).toBe(
        'wss://vibematch-api.onrender.com/ws/chat/',
      )
    })

    it('converts a bare http base to ws, not wss', () => {
      // The scheme has to follow the base, not the page. Forcing wss onto an
      // http backend would fail the handshake rather than downgrade.
      expect(buildUrl('/ws/chat/', 'http://127.0.0.1:8010')).toBe(
        'ws://127.0.0.1:8010/ws/chat/',
      )
    })

    it('tolerates a trailing slash', () => {
      expect(buildUrl('/ws/chat/', 'https://api.example.com/')).toBe(
        'wss://api.example.com/ws/chat/',
      )
    })

    it('tolerates surrounding whitespace', () => {
      expect(buildUrl('/ws/chat/', '  https://api.example.com  ')).toBe(
        'wss://api.example.com/ws/chat/',
      )
    })

    it('accepts a bare hostname by assuming https', () => {
      expect(buildUrl('/ws/chat/', 'api.example.com')).toBe(
        'wss://api.example.com/ws/chat/',
      )
    })

    it('accepts a ws:// base unchanged', () => {
      expect(buildUrl('/ws/chat/', 'ws://127.0.0.1:8010')).toBe(
        'ws://127.0.0.1:8010/ws/chat/',
      )
    })

    it('drops any path on the base rather than concatenating it', () => {
      // A base of `https://host/api` would otherwise yield
      // `wss://host/api/ws/chat/`, which no route serves.
      expect(buildUrl('/ws/chat/', 'https://api.example.com/api')).toBe(
        'wss://api.example.com/ws/chat/',
      )
    })

    it('preserves a non-default port', () => {
      expect(buildUrl('/ws/chat/', 'https://api.example.com:8443')).toBe(
        'wss://api.example.com:8443/ws/chat/',
      )
    })
  })
})
