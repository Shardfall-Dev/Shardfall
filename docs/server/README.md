# Shardfall server — Foundation v1

The first step from the single-player browser game towards a persistent MMORPG: real accounts, an online character roster kept on
the server, and authenticated realtime connections. The specification is [SERVER_FOUNDATION_V1.md](SERVER_FOUNDATION_V1.md).

**Update — Server Movement v1 (v0.37):** online characters now walk in the real world together and the server decides where
everyone is; see [MOVEMENT.md](MOVEMENT.md). The rest of this page describes the foundation (accounts, sessions, roster,
gateway), which is unchanged.

**What this is not yet:** apart from walking, the world is not simulated on the server. Movement, combat, NPCs, crafting, trading, PvP and loot still run
only in the offline game. The UI says so on every online screen; nothing here should be described as "multiplayer" until the
gameplay itself is server-authoritative.

- Local setup: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- Hosting, Google / Apple sign-in, backups, rollback: [DEPLOYMENT.md](DEPLOYMENT.md)
- What was built against the specification, test results and blockers: [STATUS.md](STATUS.md)

## Architecture

```
browser (the game, Shardfall_v0.36.html)                      Supabase (managed)
  title screen → Play Offline (unchanged, localStorage)         ├─ Auth: passwords, email confirmation, reset,
               → Play Online  (src/online.js) ──HTTPS──┐        │        Google / Apple (OAuth/OIDC + PKCE)
                                 cookie: opaque id     │        └─ Postgres: schema game (this repo's migrations)
                                                       ▼                        ▲
                         Shardfall server (Node 22, TypeScript, Fastify) ───────┘
                           /api/auth/*   BFF: talks to Supabase Auth, keeps its tokens encrypted server-side
                           /api/account, /api/realms, /api/characters
                           /ws           WebSocket gateway (presence lobby) + 50 ms world tick
                           /             the newest game build and its audio (same origin)
```

One process serves the game page, the API and the WebSocket from one origin, so cookies are first-party and no CORS is needed.
GitHub Pages keeps publishing the static game: it has no server, so its Play Online button explains that online play needs one.

| Folder | What |
| --- | --- |
| `server/src/config` | environment (`.env.example`) — refuses to start half-configured |
| `server/src/auth` | Supabase Auth client, sessions, PKCE flows, guards (origin, CSRF, recent sign-in), `/api/auth/*` |
| `server/src/accounts` | `/api/session`, `/api/config`, account settings, linked providers, export, deletion |
| `server/src/characters` | roster, creation, deletion / restore / purge, snapshots |
| `server/src/realtime` | the WebSocket gateway |
| `server/src/world` | the world loop: the reserved 50 ms tick and command queue |
| `server/src/db` | pool, transactions, the migration runner |
| `shared/protocol.js` | the realtime protocol — one file used by the server and built into the game |
| `shared/game-rules-adapter.js` | loads the game's own pure rules (`src/rules.js` … `src/creation.js`) for the server |
| `supabase/migrations` | the one database schema source (Supabase CLI and `npm run migrate` both apply it) |
| `server/dev` | docker compose for PostgreSQL + Supabase Auth + Mailpit, dev keys |
| `src/online.js` | the online screens inside the game (sign in, register, reset, roster, account, lobby) |
| `tests/server`, `tests/e2e` | unit, integration and browser suites |

### Stack decisions

- **Node.js 22 LTS + TypeScript, run with `tsx`** (no separate compile step; `npm run typecheck` runs `tsc`). Fastify 5,
  `@fastify/websocket` (ws), `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/static`, `pg`. Exact versions in
  `package.json`; no Redis, queues, Kubernetes or microservices.
- **Supabase Auth for identity** (managed; the same server, GoTrue, runs locally in Docker for development and CI). Chosen over
  Firebase Auth / Auth0 / Clerk because it comes with the PostgreSQL we need anyway, has email + Google + Apple out of the box,
  and a free tier of 50,000 monthly active users. It is used through its REST API from the server only; the browser never sees a
  Supabase token. Alternatives considered: Auth0 / Clerk (excellent, but a second vendor and paid sooner), self-hosted
  Keycloak / Ory (more to operate), our own password storage (ruled out by the specification and by good sense).
- **Server-side sessions (BFF)** instead of handing JWTs to the browser: one opaque random id in an `HttpOnly; Secure;
  SameSite=Lax; __Host-` cookie, revocable at once, rotated at every sign-in; the Supabase refresh token stays encrypted in the
  database. One session system only.
- **PostgreSQL schema `game`**, not exposed through the Supabase Data API (RLS on, no policies, no grants to `anon` /
  `authenticated`). Only the server's `DATABASE_URL` touches it.

## Accounts and sessions

| Flow | How |
| --- | --- |
| Register | `POST /api/auth/register` → Supabase Auth `signup` with a PKCE challenge; the verifier stays on the server, the browser gets a one-hour flow cookie. Same answer whether or not the address already has an account. |
| Verify email | The email link goes to Supabase Auth, which confirms the address and redirects to `/api/auth/callback?code=…`; in the same browser the server exchanges the code and signs the player in. In another browser the address is still confirmed and the player is asked to sign in. |
| Sign in | `POST /api/auth/login` → Supabase password grant. Unconfirmed addresses are refused with "confirm your email first"; wrong passwords and unknown addresses get the same generic error. |
| Sign out | `POST /api/auth/logout` (this browser) and `/api/auth/logout-all` (every device; also revokes the Supabase refresh tokens). Open WebSockets of the ended sessions close at once. |
| Password reset | `POST /api/auth/recover` → email → callback creates a 30-minute **recovery** session that can only set a new password (`POST /api/auth/password`); then every other session ends and the browser gets a fresh full session. |
| Google / Apple | `GET /api/auth/oauth/google|apple` → Supabase Auth `/authorize` with PKCE → provider → Supabase → `/api/auth/callback`. A button appears only when the provider is enabled in the server environment **and** in Supabase Auth. |
| Re-authentication | Linking, unlinking, email change, password change from settings and account deletion need a sign-in in the last 10 minutes: `POST /api/auth/reauth` (password) or the provider. |
| Linking | Explicit only: `POST /api/auth/oauth/:provider/link` after re-authentication (Supabase manual identity linking). The callback checks the returned user is the same account; nothing is ever merged by email or name. |
| Account deletion | Recent sign-in + typing `DELETE MY ACCOUNT`. The Supabase identity is deleted first (needs `SUPABASE_SERVICE_ROLE_KEY`); then characters and items are removed, the account row is tombstoned and every session revoked. |
| Export | `GET /api/account/export`: the account, characters, items and the security events, as JSON. |

Sessions expire after 30 days, or 7 days without use, and are re-confirmed with Supabase Auth every 10 minutes (a deleted, banned
or signed-out-everywhere user loses access at the next request; if Supabase is unreachable, existing sessions keep working for up
to an hour). Accounts are keyed by the Supabase user id (`auth_subject`), never by email; the game database stores no email
address. Apple's private relay addresses and missing names are fine: the display name is optional.

**Supabase's own linking.** Supabase Auth links a new Google/Apple identity to an existing user automatically only when the
provider says the email is verified; unverified emails are never linked. That is the provider's behaviour, not ours — our server
only ever trusts the Supabase user id it gets back from a code exchange.

## Characters

- Five slots per account per realm (`accounts.character_slots`, capped by `realms.max_characters_per_account`), enforced in a
  transaction that locks the account row, so parallel requests cannot exceed it.
- Names: 2–16 letters, numbers, spaces, apostrophes, hyphens (the game's own policy); unique per realm case- and
  space-insensitively by a unique index (`name_key`), so a race is settled by the database.
- `POST /api/realms/:realm/characters` takes **only** the creator's choices: name, look, STR/DEX/INT, up to three skills, town.
  Any other field (gold, items, skill values, vitals) is refused (400). The choices go through `SF.CREATION.validate` — the very
  function the offline creator uses — and the server then generates the progression (skills in tenths, all others 0.0, locks
  raised), the starter kit (`SF.CREATION.kit` + `applyKit`), vitals and spawn. Every item gets a server-owned UUID.
  Retries are safe with an `Idempotency-Key` header.
- Deletion needs the character's name typed; the character leaves the roster and frees its slot at once, keeps its name for a
  7-day recovery window (`POST /api/characters/:id/restore`), and is then purged with its items.
- Offline saves are never read by the server: there is no import. The offline game keeps its export.

Database tables: `realms`, `accounts`, `sessions`, `auth_flows`, `characters`, `items` (`container` pack | bank | equip, `slot`
for worn pieces, `props` for material, durability, spells …, `state_version` on each row for optimistic updates later),
`audit_events`, and the sequence `actor_id_seq` reserved for server-owned NPC / creature ids.

## Realtime (`/ws`)

Protocol v1 is defined once in [`shared/protocol.js`](../../shared/protocol.js). Text frames carrying JSON:
`{ v: 1, type, id?, seq?, p }` — `id` is the client's request id echoed on the reply, `seq` a per-connection counter on every
server message (a gap triggers `resync`).

| Client → server | |
| --- | --- |
| `hello { characterId }` | join with one of your own characters |
| `ping { t }` | latency; answered with `pong { t, tick, serverTime }` |
| `resync {}` | ask for a fresh `snapshot` |
| anything else | `move`, `attack`, `cast`, `equip`, `pickup`, `drop`, `trade`, `gold`, `skill`, `stat`, `inventory`, `damage`, `craft`, `loot`, `say` are **refused** with `not_authoritative`; unknown types with `unknown_type` |

| Server → client | |
| --- | --- |
| `welcome { protocol, tick, tickMs, serverAuthoritative: false, character, presence[], resumed }` | the authoritative snapshot (with items) and who else is here |
| `presence.join { character }`, `presence.leave { characterId }` | others arriving and leaving (name, look, town, title — no account ids) |
| `snapshot`, `pong`, `error { code, message }`, `kicked { reason }` | |

Rules: the upgrade needs a full session cookie and an allowed `Origin` (no token in the URL); `hello` checks the character belongs
to the account. One connection per character — a second one takes over and the first is closed (4004). One active character per
account per realm. A dropped connection keeps the character present for 10 s, so a reconnect is seamless (no leave/join); sign-out,
password change, account or character deletion close it at once (4010, no grace). Heartbeat every 15 s; 16 KiB frame limit;
token-bucket rate limit (20 burst, 10/s); bounded send queue (slow clients are closed with 1013). Outgoing events are flushed on
the world tick, which runs at the game's own 50 ms step. The `World` class (`server/src/world/world.ts`) has a command queue whose
handler table is empty: no gameplay command is accepted until its server simulation exists.

Close codes: 4001 unauthorized · 4003 forbidden (not your character) · 4004 taken over · 4005 protocol · 4008 rate limit ·
4010 session ended · 1009 frame too big · 1013 slow consumer.

## Security checklist

- No custom cryptography or password storage: Supabase Auth stores passwords; the server uses `node:crypto` CSPRNG tokens,
  SHA-256 lookups, AES-256-GCM for tokens at rest, RFC 7636 S256 PKCE.
- Cookies `HttpOnly; Secure; SameSite=Lax; Path=/` with the `__Host-` prefix in production (plain `sf_session` only for
  `http://localhost` development — the server refuses `COOKIE_SECURE=false` anywhere else).
- CSRF: every mutation needs an allowed `Origin`, the `X-Shardfall: 1` header (forces a CORS preflight the server never grants)
  and, when signed in, the session's `X-CSRF-Token`.
- Ownership on every character query (`account_id` in the `WHERE`); a guessed UUID of someone else's character is a 404.
- Rate limits: 300/min per IP overall, 10/min per IP on sign-in / sign-up / reset / callback, 30/min per session on creation,
  per-connection limits on the WebSocket.
- Generic errors where specifics would reveal accounts; redirects only to fixed paths on `PUBLIC_URL`.
- Logs redact cookies, authorization, CSRF tokens, passwords and provider tokens; responses carry `nosniff`, `DENY` framing,
  `same-origin` referrer, HSTS in production, `no-store` on the API.
- Least privilege: the game schema is invisible to the Supabase Data API; the service-role key is only read for account deletion.

## What comes next

Server-owned movement, collision, interest management and synchronisation; then combat, skills, inventory and the economy, one
subsystem at a time, each moving its rules from the browser into `World` command handlers. Until then the offline game remains
the place to play.
