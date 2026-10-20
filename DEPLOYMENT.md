# Deploying the VibeMatch frontend — Vercel (free plan)

This repo is the React SPA. It deploys to **Vercel** as a static Vite
build, and it is deployed **independently** of the backend.

**Deploy the backend first.** The `/api` rewrite below needs the Render
service's hostname. If the backend does not exist yet, deploy it and come
back — the walkthrough is in that repo's `DEPLOYMENT.md`.

Vercel's Hobby plan is **non-commercial**: personal and demo use only.

---

## 1. Prerequisites

- This repo pushed to GitHub. Vercel deploys from a Git remote.
- The backend deployed on Render, and its hostname
  (`<service-name>.onrender.com`).
- A Vercel account on the Hobby plan.

---

## 2. Import the project

Vercel dashboard → **Add New** → **Project** → pick this repo. Set:

| Setting | Value |
|---|---|
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| **Root Directory** | **leave as the repo root** |

There is no root directory to configure: this repo's root *is* the app
root. `vercel.json`, `package.json` and `vite.config.js` are all at the top
level. (If you are migrating from a monorepo, delete any `Root Directory:
frontend` setting — it would point Vercel at a directory that does not
exist in this repo.)

No secrets are bundled. The build reads only `VITE_WS_URL`, which is a
public URL, and it is optional.

---

## 3. Set `BACKEND_ORIGIN`

**Settings → Environment Variables**, for all environments:

| Name | Value |
|---|---|
| `BACKEND_ORIGIN` | `<service-name>.onrender.com` — **no** `https://` |

`vercel.json` proxies `/api/*` to it:

```json
{ "source": "/api/:path*",
  "destination": "https://$BACKEND_ORIGIN/api/:path*",
  "env": ["BACKEND_ORIGIN"] }
```

Two details in that file are deliberate and both are load-bearing:

- **`"env": ["BACKEND_ORIGIN"]` is required.** Vercel substitutes `$VAR`
  only for names listed in the rewrite's own `env` array. Without it the
  literal string `$BACKEND_ORIGIN` is sent as the host and every API call
  fails to resolve. (This is documented in Vercel's config schema; their
  prose reference shows the same mechanism under `routes` only, so it is
  worth confirming with one request after the first deploy.)
- **`respectOriginCacheControl: false`.** Vercel caches external rewrites
  by default for projects created on or after 2026-04-06. This API serves
  authenticated, per-user responses, so a cached one would be handed to the
  wrong user. Caching is off twice over: this flag, and the
  `x-vercel-enable-rewrite-caching: 0` header.

The API rewrite is listed **before** the SPA fallback. Rewrites are matched
in order, so the other order would send `/api/...` to `index.html`.

---

## 4. Set `VITE_WS_URL`

**WebSockets cannot go through a Vercel rewrite.** `/api` is proxied;
`/ws/` cannot be — rewrites do not carry the upgrade. So the SPA connects
to Render directly:

| Name | Value |
|---|---|
| `VITE_WS_URL` | `https://<service-name>.onrender.com` |

Set it in Vercel and redeploy — **Vite inlines `VITE_*` at build time**, so
a change needs a new build, not just a restart.

Leave it unset and sockets connect to the page's own origin. That is
correct for local development and for any single-origin deployment; it is
wrong here, and the symptom is chat and notifications silently never
connecting while the REST API works fine.

`VITE_WS_URL` is **not** an API base URL. `/api` stays relative on purpose:
the refresh cookie is scoped to `/api/auth/` with `SameSite=Lax`, and
`Lax` cookies are not sent cross-site. Pointing the client at an absolute
API URL would break login in a way that looks like an expired session.
There is deliberately no `VITE_API_URL`.

---

## 5. Deploy, then close the loop

Deploy, note the URL Vercel gives you (`https://<app>.vercel.app`), and go
back to the **backend** repo's deployment doc §4 to put it in
`CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` and
`DJANGO_ALLOWED_HOSTS`.

Until you do, the API will reject this origin's unsafe requests, and the
backend may refuse to boot at all — it will not start with `DEBUG` off
while `CSRF_TRUSTED_ORIGINS` is unset, and it crash-loops with a message
that says so.

---

## 6. Why the cookie works through the proxy

This is the part most likely to break silently, so it is worth
understanding rather than copying.

The refresh token is an httpOnly cookie. `SameSite=Lax` cookies are sent
on same-site requests only. Because Vercel *proxies* `/api` rather than
redirecting to it, the browser sees one origin — `https://<app>.vercel.app`
— and the cookie is **first-party** there. `Lax` is correct, and `None`
would additionally trigger third-party-cookie blocking in Chrome and
Safari.

Verified end to end against a local stand-in for the Vercel rewrite. The
`Set-Cookie` on login, as the browser receives it:

```
refresh=…; expires=…; HttpOnly; Max-Age=604800; Path=/api/auth/; SameSite=Lax; Secure
```

No `Domain` attribute, so the browser scopes it to the Vercel host.
`HttpOnly`, so JavaScript cannot read it. `Path=/api/auth/`, so it is not
sent on ordinary API calls. And the refresh token is **not** in the
response body — only the short-lived access token is, which the SPA keeps
in memory.

---

## 7. Verifying the deployment

**The proxy works:**

```bash
curl -s https://<app>.vercel.app/api/health/     # the API, through Vercel
```

A JSON body here means the rewrite, the `BACKEND_ORIGIN` substitution and
the backend are all working. A `404` means the SPA fallback caught it — the
rewrite order or `BACKEND_ORIGIN` is wrong.

**The cookie survives the proxy.** In a browser: log in, open DevTools →
Application → Cookies, and confirm the `refresh` cookie is on the Vercel
host with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/auth/`. Then
**reload the page** — if the session survives the reload, the refresh path
works through the proxy. If it does not, the cookie is being dropped, which
almost always means the API URL is absolute rather than relative.

**WebSockets connect directly** — in the browser console on the deployed
SPA:

```js
new WebSocket('wss://<service>.onrender.com/ws/notifications/', ['access_token', '<paste access token>'])
```

Expect `onopen`. The subprotocol form is used rather than `?token=`
because query strings land in proxy and server access logs.

**The SPA routes correctly.** Navigate directly to a deep link such as
`https://<app>.vercel.app/admin/overview` and reload. It should render the
app, not a 404 — that is the SPA fallback rewrite doing its job.

---

## 8. Rolling back

Vercel keeps previous deployments: **Deployments** → pick one →
*Promote to Production*.

Rolling the frontend back is safe on its own — but note that
`VITE_WS_URL` and any other `VITE_*` value is **inlined at build time**, so
a rolled-back deployment carries the value it was built with, not the
current environment variable.

---

## Appendix: environment variables

| Variable | Required | Value | When it applies |
|---|---|---|---|
| `BACKEND_ORIGIN` | yes | `<service>.onrender.com`, no scheme | runtime — substituted into the rewrite |
| `VITE_WS_URL` | yes, in this deployment | `https://<service>.onrender.com` | **build time** — needs a redeploy to change |

**Never put a secret behind a `VITE_` prefix.** Vite inlines every `VITE_*`
value into the shipped JavaScript, so it is readable by anyone who opens
the bundle. There is no secret this app needs — the refresh token is an
httpOnly cookie set by the API, and the access token lives in memory only.
