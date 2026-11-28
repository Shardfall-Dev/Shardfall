# Deploying the Shardfall server

Nothing in this repository creates paid resources. This is a guide for the repository owner. Prices change: check them before
you sign up (figures below were read from the providers' pricing pages in November 2026).

## What runs where

| Piece | Recommended | Why |
| --- | --- | --- |
| Identity + database | **Supabase** project (Free to start, Pro when it matters) | managed Auth (email, Google, Apple) and PostgreSQL in one place |
| Game server (HTTP + WebSocket, always on) | **Fly.io** Machine, `shared-cpu-1x` 256–512 MB, one region near the database | long-lived WebSockets, TLS included, per-second billing |
| Static game | GitHub Pages (as today) | offline play only; the server also serves the game for online play |

Supabase Free: 50,000 monthly active users, 500 MB database, 2 projects, **projects pause after a week of inactivity** and have
no backups — fine for the alpha, not for real players. Pro (from $25/month): 8 GB database, daily backups (7 days), no pausing.
Fly.io: a `shared-cpu-1x` 256 MB Machine is about $2.19/month running all month (plus a dedicated IPv4 if you want one; the
shared IPv4 / IPv6 are free). Alternatives that keep WebSockets alive: Railway, Render (paid instance — free instances sleep),
any small VPS with Caddy. Serverless platforms (Vercel / Netlify functions, Cloudflare Workers without Durable Objects) do
**not** fit: the gateway holds connections and runs a tick.

## 1. Supabase project (one per environment: staging, production)

1. Create the project (region near your players). Note: Project URL, publishable/anon key, secret/service_role key, the
   database connection string (Settings → Database; session pooler or direct connection on port 5432 — the server uses
   ordinary sessions and advisory locks, so not the transaction pooler on 6543).
2. Authentication → Sign In / Providers → Email: enable, **Confirm email on**, minimum password length 10.
3. Authentication → URL Configuration: Site URL `https://play.your-domain`, Redirect URLs `https://play.your-domain/api/auth/callback`
   and `https://play.your-domain/?online=account` (staging gets its own entries). Nothing else.
4. Authentication → Emails → SMTP: configure a real sender (Supabase's built-in mailer is rate limited and meant for testing).
5. Authentication → Settings: enable **manual identity linking** if you want players to link Google/Apple to an existing account.
6. Apply the schema: `DATABASE_URL=… npm run migrate` from your machine or as a release step (or `supabase db push`).

## 2. Google sign-in (optional)

Needs a Google Cloud project. APIs & Services → OAuth consent screen (app name, support email, your domain); Credentials →
OAuth client ID → Web application; Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the
client id and secret into Supabase → Providers → Google, enable it, then set `OAUTH_GOOGLE_ENABLED=true` on the server.

## 3. Sign in with Apple (optional)

Needs a paid **Apple Developer Program** membership. In Certificates, Identifiers & Profiles: an App ID with Sign in with Apple;
a **Services ID** (this is the web client id) with domain `<project-ref>.supabase.co` and return URL
`https://<project-ref>.supabase.co/auth/v1/callback`; a **Sign in with Apple key** (.p8). Generate the client-secret JWT from the
key (Supabase's Apple guide has a generator), paste Services ID and secret into Supabase → Providers → Apple, then set
`OAUTH_APPLE_ENABLED=true`. **The Apple client secret expires every 6 months** — put the rotation in a calendar; when it lapses
Apple sign-in fails with `invalid_client`. Apple shares the name only on the first sign-in and may give a private relay address:
the game handles both (display name optional, relay addresses accepted).

## 4. The server on Fly.io

```sh
fly launch --no-deploy --dockerfile server/Dockerfile --internal-port 8787 --name shardfall-server
fly secrets set PUBLIC_URL=https://play.your-domain NODE_ENV=production TRUST_PROXY=true \
  DATABASE_URL='postgres://…' SUPABASE_AUTH_URL=https://<project-ref>.supabase.co/auth/v1 \
  SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… SESSION_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  OAUTH_GOOGLE_ENABLED=false OAUTH_APPLE_ENABLED=false
fly deploy
fly certs add play.your-domain        # then point the DNS record at the app
```

In `fly.toml` keep one Machine always running (`min_machines_running = 1`, `auto_stop_machines = "off"`): stopping it would drop
every WebSocket. Health check path `/api/health`; readiness (database + Auth reachable) is `/api/ready`. One Machine is the
supported topology for now — presence lives in memory, so a second Machine would split the lobby.

Release order: `npm run migrate` (migrations are additive and run under an advisory lock) → deploy the new image. On shutdown
the server tells connected clients it is restarting (`kicked: server_restart`) and they reconnect.

## 5. Operations

- **TLS**: terminated by Fly (or your proxy). `PUBLIC_URL` must be `https://` in production; the server refuses otherwise, sets
  `Secure` / `__Host-` cookies and HSTS, and the client uses `wss://`.
- **Secrets**: only in the host's secret store. Never in the repository, the static build, logs or URLs.
  `SESSION_ENCRYPTION_KEY` rotation signs everyone out. Rotate the service_role key from the Supabase dashboard if exposed.
- **Backups**: Supabase Pro takes daily backups (7 days; point-in-time recovery is an add-on). On Free, run
  `pg_dump --schema=game "$DATABASE_URL" > shardfall-$(date +%F).sql` on a schedule and keep the files elsewhere.
  Restore: `psql "$DATABASE_URL" < file.sql` into an empty schema. Supabase Auth users are backed up with the project.
- **Metrics**: `/api/ready` reports database / Auth reachability, open connections, present characters, takeovers,
  reconnects, refused messages, world ticks and tick overruns. Fly's dashboard shows request rates and memory; logs are JSON
  (pino) with request ids and no secrets.
- **Abuse**: rate limits are per IP (sign-in 10/min, overall 300/min) and per session (character creation). Behind a proxy set
  `TRUST_PROXY=true` so the real client IP is used.

## Rollback

- **Code**: `fly releases` → `fly deploy --image <previous image>`; or revert the merge commit and redeploy.
- **Schema**: migrations only add (this release creates the `game` and `game_meta` schemas). To remove Server Foundation v1
  entirely: stop the server, then `drop schema game cascade; drop schema game_meta cascade;` — this deletes all online accounts'
  game data (Supabase Auth users stay; delete them in the dashboard if wanted).
- **Game**: the offline game does not depend on the server. Reverting this branch's build (`Shardfall_v0.36.html`) to the previous
  one removes the Play Online button; offline saves are untouched either way.

## GitHub Pages

Pages serves static files only. It keeps publishing the newest build for offline play; its Play Online screen says that online
play needs the server. Do not put any server secret into the static build — none is needed.
