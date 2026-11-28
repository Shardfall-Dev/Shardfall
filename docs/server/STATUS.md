# Server status

## Phase 3 — Server Creatures v1 (branch `feature/server-creatures-v1`, build v0.41)

The wildlife and monsters live on the server: one population per realm from the game's own 417 spawners, one world clock,
roaming, herds bolting, hostile creatures stalking players to striking distance and giving up at their limits. Nobody is
attacked yet (combat is next). Details: [CREATURES.md](CREATURES.md).

| Area | State |
| --- | --- |
| Data | `population.json` + `ground.bin.gz` exported from the build; deterministic; creature footing equal to the game's on 102 000 points; checked in CI |
| Simulation | Tiers (56 tiles), idle by activity hours, packs, senses by `SIM`, flee, stalk, return, graveyards by night, separation; seeded per realm |
| Protocol | v3: `actor.enter` with `kind` (`player` / `creature`), the world clock in the welcome |
| Client | Creatures drawn with the game's art and interpolated; the HUD clock and light follow the server |
| Cost | ~890 creatures, about 0.1 ms per tick with one player; 120 spread-out players under 8 ms (unit test) |
| Not yet | Combat, creature-vs-creature hunting, feeding, sorties, camp clearance, creature persistence, NPCs |

---

## Phase 2 — Server Movement v1 (branch `feature/server-movement-v1.1`, build v0.40)

Online characters walk the real Anniabreen map together in the game's renderer. Walking is server-authoritative: the client
sends intents and predicts, and the server moves everyone with the shared rules and collision. Details:
[MOVEMENT.md](MOVEMENT.md).

| Area | State |
| --- | --- |
| World on the server | Exported from the build (`tools/export-world.py`), verified deterministic and collision-equal to the game on 316 000 points, checked in CI |
| Movement | Intents only; one per tick on average (credit cap 3); the game's speeds, stamina, encumbrance, shallows, slide and facing (`shared/movement.js`) |
| Client | Online mode in the game: prediction, reconciliation (zero corrections in the e2e), others interpolated 120 ms behind; no local save, no taps, only walking keys and Sprint |
| Interest | 16-tile grid, 40-tile radius plus a 4-tile leave margin, deltas only |
| Persistence | Every 30 s, on leaving the world, and on shutdown |
| Load | 150 bots, half crowded in one town: about 3 ms average tick, 0 overruns, about 14 KB/s per bot, 157 MB (CI runner) |
| Phone | CI's phone player runs in WebKit (Safari's engine) with the iPhone 13 profile |
| Screenshots | [shots-movement/](shots-movement/) (from the CI run) |

Not online yet: creatures, NPCs, combat, gathering, crafting, items, trading, doors (always open online), chat.

---

## Phase 1 — Server Foundation v1

Branch `feature/server-foundation-v1`, build **v0.36**. Specification: [SERVER_FOUNDATION_V1.md](SERVER_FOUNDATION_V1.md).
Online play is an **alpha foundation**: accounts, a persistent roster and an authenticated realtime lobby. Gameplay is not yet
server-authoritative, and nothing in the game or these docs claims otherwise.

## Against the specification

| Area | State |
| --- | --- |
| Stack | Node 22 LTS, TypeScript (run by `tsx`, checked by `tsc`), Fastify 5, `@fastify/websocket`, PostgreSQL, Supabase Auth. One deployable; no Redis / Kubernetes / microservices. Exact versions in `package.json`. |
| Structure | `server/src/{config,auth,accounts,characters,db,realtime,world}`, `shared/` (protocol + rules adapter), `src/online.js` (client), `supabase/migrations`, `tests/{server,e2e}`, `docs/server`. The game build stays the one client. |
| Email/password, verification, login, logout, reset, expiry | Done, through Supabase Auth with PKCE; tested end to end against the real Supabase Auth server and real emails (Mailpit). |
| Google / Sign in with Apple | Implemented (Supabase OAuth/OIDC, PKCE, flow cookie, callback errors and cancel). Buttons appear only when enabled here **and** in Supabase Auth. Plumbing tested with Supabase Auth's real redirect to Google using placeholder credentials. **Live sign-in not verified — needs credentials (below).** |
| Sessions | Server-side BFF: opaque id in `HttpOnly; Secure; SameSite=Lax; __Host-` cookie, rotated at sign-in, revocable, absolute + idle expiry, Supabase tokens AES-GCM encrypted, re-checked with Supabase every 10 min. |
| CSRF / origins / rate limits / generic errors / no open redirects / no secrets in logs or URLs | Done and tested. |
| Account settings, linking, unlinking, export, deletion with re-authentication | Done. Linking/unlinking need a provider configured to be exercised live. Deletion needs `SUPABASE_SERVICE_ROLE_KEY` (tested locally). |
| Database | Versioned migration (one file), constraints, transactions, `realms`, `accounts`, `sessions`, `auth_flows`, `characters`, `items`, `audit_events`, reserved `actor_id_seq`; RLS on, nothing granted to the Data API roles. Runner records Supabase-CLI-applied files. |
| Characters | 5 configurable slots per realm (atomic), one realm with realm-selection UI and API, unique names per realm (index), server validation with the game's own `SF.CREATION.validate`, server-generated progression, starter kit and item UUIDs, soft delete with a 7-day recovery window and purge, idempotent creation. No import of offline saves. |
| UI | Title screen with Play Offline / Play Online; sign in, register, verify, reset, Google/Apple (when enabled), roster with portraits, the existing creator submitting to the server, delete/restore, account page, lobby — in the creator's wood/brass/parchment style; desktop and phone (iPhone-sized touch browser in CI). Every online screen states that online play is an alpha and the world is not server-simulated. |
| Realtime | Authenticated upgrade (cookie + Origin; no token in URL), ownership check, one connection per character with takeover, one active character per account per realm, 10 s reconnect grace, heartbeat, rate limit, 16 KiB frames, bounded queues, protocol version, request ids, sequence numbers + resync, structured logs, 50 ms world tick with an empty command table. Two accounts seeing each other's presence: tested (Node clients and two real browsers). |
| Deployment | `.env.example`, `.gitignore`, docker compose (PostgreSQL + Supabase Auth + Mailpit), Supabase CLI notes, `server/Dockerfile`, hosting / Google / Apple / backups / metrics / rollback guide. No paid resources created. |
| Offline game | Unchanged rules, balance, skills, stats, art and saves. Every existing suite runs as before (`.github/workflows/ci.yml`). The online code never reads or writes the offline save (checked byte for byte in the browser flow). |

## Tests (`.github/workflows/server.yml`, every push)

- `npm run typecheck` — the server, shared declarations and tests.
- `npm run test:unit` — 14 tests: protocol (valid / malformed / forged messages), rules adapter (every template, creation rules,
  forged extras ignored, stored-item checks, spawns), crypto (AES-GCM tamper / purpose binding, PKCE, tokens).
- Migrations applied twice to a fresh PostgreSQL (second run a no-op).
- `npm run test:server` — 36 integration tests against PostgreSQL + Supabase Auth (GoTrue v2.186.0) + Mailpit:
  - auth: config / health / readiness; register → email → verified session; accounts keyed by provider id, tokens encrypted at
    rest; unverified login refused; generic wrong-password / unknown-account errors; no enumeration on register or reset; session
    rotation and server-side logout; CSRF token, Origin, missing-Origin and client-header checks (incl. login CSRF); expired,
    idle, revoked and garbage sessions; a user deleted in Supabase loses the session; password reset in the same browser and
    refused in another; re-authentication; logout everywhere; export and deletion; Google/Apple start + callback plumbing
    (PKCE parameters, Supabase's redirect to Google, disabled providers 404, cancel, missing / spent / forged flows, redirects
    stay on site); rate limits; the game page is not rate limited like the API.
  - characters: realms and slots; server-generated character persisted exactly; 13 forged / invalid payloads refused with nothing
    created; unique names incl. a three-way race; 8 parallel creations → exactly 5; idempotent retry; another account cannot
    read / delete / restore by UUID; delete → recovery-window name reservation → restore → purge (items gone, name free).
  - realtime: upgrade needs session + Origin; two accounts see each other (join, ping, resync, sequence order, no account ids,
    logout → immediate leave); foreign character → 4003; client-authoritative messages refused and state unchanged; protocol
    mismatch, oversize frame (1009), flood (4008); takeover without leave/join flicker; one character per account; reconnect
    within grace without a leave, leave after it; character deletion ends its presence; tick rate ≈ 50 ms.
- `python3 tests/e2e/online_flow.py` — two accounts in Chrome, one desktop and one iPhone-sized touch browser (Safari user
  agent): register, confirm from the inbox, roster, the creator, the lobby with each other present, leave, account page, sign out;
  offline save identical; no page errors. Screenshots are uploaded as the `server-foundation-screenshots` artifact; the copies in [shots/](shots/) come from the CI run of this branch.
- The production image is built and loads the game rules.

Not covered by automated tests: a real Google or Apple account signing in (needs credentials), real iOS Safari on a device
(the CI phone run is Chrome with an iPhone viewport, touch and Safari user agent — WebKit itself was not run), load testing.

## Blockers and external requirements

1. **Live Google sign-in** — a Google Cloud project and OAuth web client; redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`;
   client id/secret in Supabase; `OAUTH_GOOGLE_ENABLED=true`. Then verify once by hand.
2. **Live Sign in with Apple** — a paid Apple Developer Program membership; App ID, Services ID, Sign in with Apple key (.p8),
   client-secret JWT (expires every 6 months); Supabase Apple provider; `OAUTH_APPLE_ENABLED=true`. Then verify once by hand.
3. **A Supabase project and a host** for staging/production (see DEPLOYMENT.md), a real SMTP sender for Supabase Auth emails, a
   domain with TLS. None exist yet; no credentials were available to this work.
4. **`package-lock.json`** — the environment this branch was built in could not reach the npm registry, so the lockfile could not
   be generated here. Versions are pinned exactly in `package.json` and CI installs them; run `npm install` once and commit the
   resulting `package-lock.json` (CI switches to `npm ci` automatically when it exists).
5. Presence lives in one process: run one server instance until a shared presence store is added.

## Next phase

Server-owned movement, collision, interest management and state synchronisation, then combat, skills, inventory and the economy
one subsystem at a time (each as `World` command handlers backed by the shared rules), as the specification's last section says.
