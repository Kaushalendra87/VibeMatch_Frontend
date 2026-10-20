import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api and /ws to Django rather than talking to it
// cross-origin. That is not a convenience: the refresh token lives in an
// httpOnly cookie scoped to /api/auth/, and SameSite=Lax cookies are not
// sent on cross-site requests. Proxying keeps the browser convinced it is
// talking to one origin, so the cookie, the CSRF token and the WebSocket
// handshake all behave in development exactly as they do behind a single
// nginx origin in production.
//
// The backend port is read from `VITE_BACKEND_PORT` (default 8000) rather
// than hard-coded, because 8000 is a popular port and something else on the
// machine may already hold it. Changing it here is the only change needed —
// the proxy is same-origin from the browser's point of view, so CORS and
// CSRF are unaffected by which port Django listens on.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendPort = env.VITE_BACKEND_PORT || '8000'
  const backendHost = env.VITE_BACKEND_HOST || '127.0.0.1'
  const httpTarget = `http://${backendHost}:${backendPort}`
  const wsTarget = `ws://${backendHost}:${backendPort}`

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: httpTarget,
          changeOrigin: false,
        },
        '/media': {
          target: httpTarget,
          changeOrigin: false,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
        },
      },
    },
  }
})
