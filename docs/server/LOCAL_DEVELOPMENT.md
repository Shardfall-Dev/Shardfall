# Local development — Shardfall server

Needs Node.js 22 (`node -v`), Docker (for PostgreSQL, Supabase Auth and Mailpit) and Python 3 with Playwright only for the
browser suite. Nothing here talks to a real Supabase project or to Google / Apple.

## 1. Install

```sh
npm install                 # exact versions from package.json (commit the package-lock.json this creates — see STATUS.md)
```

## 2. Start the services

```sh
docker compose -f server/dev/docker-compose.yml up -d --wait
```

| Service | Address | What |
| --- | --- | --- |
| PostgreSQL 16 | `localhost:54329` (user `postgres` / `postgres`) | game data, and the `auth` schema for Supabase Auth |
| Supabase Auth (GoTrue v2.186.0) | `http://localhost:9999` | accounts, passwords, email confirmation, reset |
| Mailpit | `http://localhost:8025` | every email Supabase Auth sends lands here — open it to click confirmation and reset links |

Stop with `docker compose -f server/dev/docker-compose.yml down` (add `-v` to wipe the database).

**Alternative: the Supabase CLI.** `supabase start` (Docker too) runs the full local Supabase stack and applies
`supabase/migrations/` automatically. Then use `SUPABASE_AUTH_URL=http://127.0.0.1:54321/auth/v1`, the anon and service_role
keys `supabase status` prints, `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, and its Mailpit at
`http://127.0.0.1:54324`. Add `http://localhost:8787/**` to `additional_redirect_urls` in `supabase/config.toml` (create it with
`supabase init` if you use the CLI). `npm run migrate` recognises migrations the CLI already applied.

## 3. Configure

```sh
cp .env.example .env
node --import tsx server/dev/keys.ts      # prints SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for the dev Auth
openssl rand -base64 32                   # → SESSION_ENCRYPTION_KEY
```

Paste the three values into `.env`. The defaults in `.env.example` already point at the compose services.

## 4. Migrate and run

```sh
npm run migrate      # applies supabase/migrations to DATABASE_URL (safe to re-run)
npm run dev          # http://localhost:8787 — the game, the API and /ws, restarting on changes
```

Open `http://localhost:8787`, choose **Play Online**, create an account, open the email in Mailpit (same browser), create a
character and enter the lobby. Open a second browser profile (or a private window) with another account to see presence.

Rebuild the game after changing `src/` or `shared/protocol.js`: `./build.sh 0.36` (the server always serves the newest
`Shardfall_v*.html`).

## 5. Tests

```sh
npm run typecheck
npm run test:unit                 # no services needed
npm run test:server               # needs the compose services; each test file gets its own fresh database
python3 tests/e2e/online_flow.py  # starts the server itself; needs `pip install playwright` and Google Chrome
```

The offline game's suites are unchanged (`README.md` lists them); `.github/workflows/ci.yml` runs them and
`.github/workflows/server.yml` runs everything above on every push.

Environment for the test helpers (defaults shown): `TEST_ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres`,
`TEST_SUPABASE_AUTH_URL=http://localhost:9999`, `TEST_MAILPIT_URL=http://localhost:8025`.

## Notes

- The compose Supabase Auth enables Google with **placeholder** credentials so the button and redirect plumbing can be tested;
  real Google sign-in cannot succeed with them (Google rejects the client id). Apple is not configured locally.
- The dev JWT secret, database passwords and keys in `server/dev/` are public on purpose and must never be used anywhere else.
- Separate databases and OAuth redirect URLs for dev, staging and production: one Supabase project each (or the local stack for
  dev), each with its own `PUBLIC_URL` in the Auth redirect allow-list.
