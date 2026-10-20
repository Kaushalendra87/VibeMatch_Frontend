# VibeMatch — frontend

React 18 + Vite 5 + React Query 5 + Tailwind 3. The single-page app for the
VibeMatch matchmaking platform: a user-facing app (discovery, likes,
matches, chat, subscriptions, safety) and a staff console (analytics, user
management, moderation queues, billing, matching controls, settings).

This repository is the **frontend only**. The Django API lives in a
separate repository and is deployed separately (Render). This repo is
deployed to **Vercel** as a static build.

```
src/
  pages/             auth/, dashboard/, admin/
  components/        ui/, layout/, profiles/, admin/, matching/
  hooks/             useAdmin, useMatching, useChat, useProfile, ...
  services/          axios client + one module per API group, tabBus
  context/           Auth, Theme, Realtime
  routes/            AppRoutes, ProtectedRoute, AuthLayout
  utils/             format, constants
vercel.json          /api proxy to Render + SPA fallback
DEPLOYMENT.md        Vercel walkthrough
```

---

## 1. Requirements

| Component | Version used | Notes |
|---|---|---|
| Node | 24.21.0 | 18+ works |
| npm | 10+ | `package-lock.json` is committed — use `npm ci` for reproducible builds |

You also need the **backend running** for anything beyond the login screen.
By default the dev server proxies to it on `127.0.0.1:8000`.

---

## 2. Local setup

```bash
npm install          # or `npm ci` for a lockfile-exact install
npm run dev          # http://localhost:5173
```

There is **no `.env` to fill in.** The client calls a relative `/api` and
connects to `/ws/...`, and Vite proxies both to Django. That is deliberate
rather than convenient: the refresh token lives in an httpOnly cookie
scoped to `/api/auth/` with `SameSite=Lax`, and Lax cookies are not sent on
cross-site requests. Proxying keeps the browser convinced it is talking to
one origin, so the cookie, the CSRF token and the WebSocket handshake
behave in development the way they will behind a single origin in
production.

**Pointing the client at an absolute API URL would break login** in a way
that looks like an expired session rather than a config mistake. There is
deliberately no `VITE_API_URL`, and there is no supported way to set one.
See `.env.example`.

If the backend is not on the default port, copy `.env.example` to
`.env.local` and set `VITE_BACKEND_PORT` (and `VITE_BACKEND_HOST` if it is
not on this machine). The dev proxy reads those; it does not read a proxy
target.

---

## 3. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the built output locally |
| `npm test` | `vitest run` — the suites in §4 |
| `npm run test:watch` | the same, in watch mode |
| `npm run lint` | `eslint src` |

---

## 4. Tests

```bash
npm test        # 48 passed, 1 todo
npm run lint    # 0 errors
```

Three suites, and they are not incidental — each covers a seam that fails
silently rather than loudly:

| Suite | What it protects |
|---|---|
| `src/services/client.test.js` | the axios interceptor: refresh-on-401, request queueing while a refresh is in flight, CSRF on refresh and logout |
| `src/services/websocket.test.js` | the socket lifecycle: reconnect backoff, and the access token as a **subprotocol** |
| `src/routes/ProtectedRoute.test.jsx` | the auth gate and the email-verification gate |

`npm run lint` reports **0 errors**. It does report a handful of
`react-hooks/set-state-in-effect` warnings on pre-existing effects that
sync a draft from fetched data; those are warnings, not errors, and the
build does not fail on them.

---

## 5. Deploying

Full walkthrough in **[`DEPLOYMENT.md`](DEPLOYMENT.md)**. The short version:

- Vercel builds this repo directly. There is **no root directory to set** —
  this repo's root *is* the app root.
- `vercel.json` proxies `/api/*` to the Render backend so the refresh
  cookie stays **first-party**, which is what makes `SameSite=Lax`
  correct.
- The API rewrite is listed **before** the SPA fallback; rewrites match in
  order, so the other order would send `/api/...` to `index.html`.
- **WebSockets cannot go through a Vercel rewrite.** The SPA connects to
  Render directly via `VITE_WS_URL`. Without it, chat and notifications
  silently never connect while the REST API works fine.
- `BACKEND_ORIGIN` (a Vercel env var, no scheme) is what the rewrite
  targets. It is substituted at runtime, so changing it does not need a
  rebuild — but `VITE_WS_URL` is inlined at build time and **does**.

No secrets are bundled. The build reads only `VITE_WS_URL`, which is a
public URL, and it is optional. Vite inlines every `VITE_*` value into the
shipped JavaScript, so never put a secret behind that prefix.

---

## 6. Security notes

**Access tokens live in memory; the refresh token lives in an httpOnly
cookie.** Never move either into `localStorage`. The client is built around
this: an access token that expires triggers a refresh through the cookie,
and the new token is held in memory only.

**The WebSocket passes its access token as a subprotocol**, never in the
query string, because URLs end up in logs and referrers:

```js
new WebSocket(url, ['access_token', token])
```

**Navigation visibility is convenience only.** Hiding an admin link does
not and must not replace server-side authorization — every admin route is
enforced by the API.

---

## 7. Known gaps

- **Payments are not integrated.** The subscription page renders plans and
  the checkout call returns `503 payments_unavailable`; nothing charges
  anyone. Do not present a subscription as purchased.
- **A like is not a match.** The UI only shows a mutual match when the
  server confirms one.
- **Verification badges are server-driven.** Never decorate an account with
  a verification badge the API has not reported.
