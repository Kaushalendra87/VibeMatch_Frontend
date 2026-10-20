import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Test configuration, kept separate from `vite.config.js`.
 *
 * Separate rather than merged because the two want opposite things. The
 * dev server configures a proxy to Django — a test that reached a real
 * backend would be testing the backend, and would pass or fail depending
 * on whether something happened to be listening on port 8000. Nothing here
 * proxies; every network call in a test is either mocked or an assertion
 * about how the client *builds* the request.
 *
 * The `test` block itself is deliberately small. The interesting choices
 * are the setup file (which installs the DOM matchers and the browser APIs
 * jsdom does not implement) and the environment, and both are documented
 * where they live rather than here.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Colocated with the code under test: `src/**/*.test.js(x)`. Keeping
    // them next to their subject is what makes a test discoverable by
    // whoever is editing the module, which matters more here than a tidy
    // top-level directory — these tests exist to be read alongside the
    // code they pin.
    include: ['src/**/*.test.{js,jsx}'],
    // `node_modules` is excluded by default; `dist` is not, and a built
    // bundle containing a stale copy of a test would run twice.
    exclude: ['node_modules', 'dist'],
    restoreMocks: true,
    clearMocks: true,
  },
})
