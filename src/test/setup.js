/**
 * Test environment setup, run once per test file.
 *
 * Three jobs, in order of how surprising they are if missing:
 *
 * 1. **Register the DOM matchers** (`toBeInTheDocument`, `toHaveAttribute`,
 *    …). Without this a test fails with "toBeInTheDocument is not a
 *    function", which reads like a typo rather than a missing import.
 *
 * 2. **Fill in the browser APIs jsdom does not implement.** jsdom is a DOM
 *    implementation, not a browser, and it ships without `matchMedia`,
 *    `IntersectionObserver` or a layout engine. Anything the app calls
 *    during render has to exist or the component throws before the
 *    assertion runs — and the failure looks like a bug in the component.
 *
 * 3. **Give every test a clean storage state.** `localStorage` and cookies
 *    persist across tests within a file, so a test that signs a user in
 *    would leak that state into the next one. Tests that depend on order
 *    are the kind that pass locally and fail in CI.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// ── 1. jsdom gaps ────────────────────────────────────────────────────

/**
 * `matchMedia`, which jsdom does not implement.
 *
 * Returns a MediaQueryList that always reports "no match" — i.e. light
 * theme. `ThemeContext` reads this on mount, so without it every test that
 * renders the provider throws on an undefined function.
 *
 * A stub rather than a full implementation: nothing under test depends on
 * media queries actually matching. A test that needs dark mode should set
 * it through the context or the stored preference, which is the path the
 * app itself uses, rather than by faking a query result.
 */
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated, but still called by some libraries
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

/**
 * `IntersectionObserver`, used by the infinite-scroll sentinel.
 *
 * Never fires its callback. An observer that immediately reported
 * "intersecting" would make every list test load a second page, which is
 * a different test than the one being written. Tests that want a page
 * loaded should call the loader directly.
 */
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

/** `ResizeObserver`, used by Recharts' responsive container. */
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

/**
 * `scrollIntoView`, which jsdom defines but leaves as a no-op that throws
 * in some versions. `MessageList` calls it when a conversation opens.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

// ── 2. Per-test isolation ────────────────────────────────────────────

beforeEach(() => {
  // A test that sets a theme preference or a tab-bus message must not
  // affect the next one.
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  // Unmount anything a test rendered. Testing Library does this
  // automatically when `globals` is on, but it is explicit here because
  // the token-refresh tests mount components that hold timers, and a
  // leaked tree would keep them alive into the next test.
  cleanup()
})
