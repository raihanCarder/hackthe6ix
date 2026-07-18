# Authentication

Check-In Champions has two auth modes:

- **Auth0 mode** when `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` are all set.
- **Local dev mode** when any Auth0 value is missing. This uses a local demo cookie and never stores passwords.

Auth0 is the production identity source of truth. The app database stores profile and game state only.

## Environment Variables

Required for Auth0 mode:

```bash
AUTH0_DOMAIN="your-tenant.us.auth0.com"
AUTH0_CLIENT_ID="..."
AUTH0_CLIENT_SECRET="..."
AUTH0_SECRET="..."
APP_BASE_URL="http://localhost:3000"
```

`APP_BASE_URL` controls the callback URL sent to Auth0. For local dev, this app sends:

```text
http://localhost:3000/auth/callback
```

Restart `npm run dev` after changing `.env`; auth configuration is read when the server starts.

## Auth0 Dashboard Setup

In **Auth0 Dashboard → Applications → your application → Settings**, configure:

```text
Allowed Callback URLs:
http://localhost:3000/auth/callback

Allowed Logout URLs:
http://localhost:3000

Allowed Web Origins:
http://localhost:3000
```

For deployment, add production equivalents, comma-separated:

```text
https://your-domain.com/auth/callback
https://your-domain.com
```

Callback URLs must match exactly, including protocol, host, port, path, and trailing slash.

## Google Social Login Setup

When Google is connected through Auth0, Google redirects back to Auth0, not directly to this app.

In **Google Cloud Console → OAuth Client**, configure:

```text
Authorized JavaScript origins:
https://YOUR_AUTH0_DOMAIN

Authorized redirect URIs:
https://YOUR_AUTH0_DOMAIN/login/callback
```

Example:

```text
Authorized JavaScript origins:
https://dev-example.us.auth0.com

Authorized redirect URIs:
https://dev-example.us.auth0.com/login/callback
```

Do not put `http://localhost:3000/auth/callback` in Google unless the app is talking directly to Google. In this app, Auth0 brokers Google login.

## Routes And Endpoints

### Auth0 SDK Routes

These routes are served by `auth0.middleware(request)` in `src/proxy.ts` when Auth0 mode is enabled:

| Route | Method | Purpose |
| --- | --- | --- |
| `/auth/login` | `GET` | Starts Auth0 Universal Login. Supports `returnTo`, for example `/auth/login?returnTo=%2Fsearch`. |
| `/auth/callback` | `GET` | Receives the authorization code from Auth0 and writes the app session cookie. Must be in Auth0 Allowed Callback URLs. |
| `/auth/logout` | `GET` | Clears the Auth0 session and redirects through Auth0 logout. |
| `/auth/profile` | `GET` | SDK user profile endpoint, if needed for debugging or future UI. |
| `/auth/access-token` | `GET` | SDK token endpoint. Do not expose tokens to normal UI unless a feature explicitly needs it. |
| `/auth/backchannel-logout` | `POST` | SDK back-channel logout route. |

The app currently links to `/auth/login` from `Nav` and `/auth/logout` from the account dropdown.

### App Auth API

| Route | Method | Auth Mode | Purpose |
| --- | --- | --- | --- |
| `/api/me` | `GET` | Auth0 or dev | Returns `{ authMode, user }`. If signed in, also syncs the local `User` record. |
| `/api/dev/login` | `POST` | Dev only | Accepts `{ "username": string }`, sets `cic_dev_session`, and returns `{ ok: true }`. Returns `404` in Auth0 mode. |
| `/api/dev/logout` | `POST` | Dev only | Deletes `cic_dev_session`. Used only by the local demo sign-in flow. |

`/api/me` is the client-side source of truth for whether the current browser is signed in.

### Protected Product APIs

These endpoints call `requireUser()` and return `401 { "error": "Sign in to play" }` when no session exists:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/search` | `POST` | Create a trip search. |
| `/api/search/[id]/questions` | `GET` | Load adaptive questions for a saved search. |
| `/api/packs/open` | `POST` | Open a Trip Pack for a search. |
| `/api/packs/[id]` | `GET` | Replay a pack opening. |
| `/api/cards` | `GET` | Load the signed-in user's collection. |
| `/api/cards/[id]/rehydrate` | `GET` | Refresh live availability for a saved card. |
| `/api/tournaments` | `POST` | Create and run a tournament. |
| `/api/tournaments/[id]` | `GET` | Replay a tournament. |

Client pages may redirect users to Auth0 for convenience, but API routes remain the real protection boundary.

## Session And User Sync

`src/lib/auth.ts` exposes `getSessionUser()`:

- In Auth0 mode, it reads the Auth0 SDK session.
- In dev mode, it reads the `cic_dev_session` cookie.

`src/lib/api/core.ts` exposes `requireUser()`:

- Reads the session with `getSessionUser()`.
- Throws `401` when signed out.
- Calls `syncUser(session)` when signed in.

`src/lib/userSync.ts` upserts `User` by `auth0Sub`:

- `auth0Sub` comes from Auth0 `session.user.sub` or local dev `dev|<slug>`.
- `username` comes from `name` or `nickname`, falling back to `Traveler`.
- `email` and `avatarUrl` are synced when provided by Auth0.

## Frontend Behavior

- `src/components/Nav.tsx` calls `/api/me` on route changes.
- Signed-out Auth0 users see a `/auth/login` link.
- Signed-in users see the account settings dropdown and can sign out from there.
- `src/components/ProtectedLink.tsx` protects home CTAs:
  - If `/api/me` returns a user, it routes normally.
  - If signed out in Auth0 mode, it uses `window.location.assign("/auth/login?returnTo=<path>")`.
  - If signed out in dev mode, it lets the target page/API fallback handle local sign-in.
- `/search` and `/collection` include client-side direct-load redirects for signed-out Auth0 users.

Avoid Server Component redirects to `/auth/login` unless they are tested against the Auth0 SDK version in use. Next can attempt RSC navigation against auth routes, which can produce confusing fallback behavior.

## Common Failures

### `redirect_uri_mismatch`

The callback URL sent by the app is not present exactly in Auth0's Allowed Callback URLs.

For local dev, add:

```text
http://localhost:3000/auth/callback
```

For Google social login, also verify Google has:

```text
https://YOUR_AUTH0_DOMAIN/login/callback
```

### Auth0 env is set but app still shows dev sign-in

Restart the Next dev server. Auth mode is evaluated from env at server startup.

### `/auth/login` returns 404 for `HEAD`

Use normal browser navigation or `GET`. The SDK login route is intended to start an interactive browser login flow.

### Protected page loads, then redirects

This is expected for client-side protection. The protected API routes still enforce auth server-side.
