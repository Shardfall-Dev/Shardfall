# Shardfall Server Foundation v1 — implementation handoff

Baseline main at planning: fba88cc786d9a113fef28bbf4eaa427e4c2b5706 (v0.33). Fetch latest main before implementation. Read AGENTS.md, README.md, src/creation.js, src/creation-ui.js, src/game.js, src/rules.js, src/stats.js, src/world.js and relevant tests. Read the audit at https://github.com/Shardfall-Dev/Shardfall/blob/98e88c95bc9bbf524c079ee7722fb5c2c15583dc/docs/audits/v0.33-stability-2026-11-28.md. Keep stabilization separate. Work on feature/server-foundation-v1, not main. Implement working code, tests and docs, not just a plan.

## Goal and scope

Deliver a real account/login flow, persistent online character roster and first authenticated game-server connection, with an explicit Offline mode preserving current gameplay and localStorage saves. Online mode is an alpha foundation, not a fully playable authoritative MMO yet. Never use offline character data as authoritative online progress. No payments, shop monetization, social systems, PvP or full gameplay migration in this PR. No new gameplay balance or renderer changes.

## 1. Architecture

Proposed cost-conscious stack: TypeScript + supported Node.js LTS, Fastify HTTP API, WebSocket transport, PostgreSQL, managed Supabase Auth and Postgres (local Supabase CLI/Docker for development). Verify current SDKs, provider rules, pricing/quotas before adoption. Use a single deployment for game API and gateway initially; use a reverse proxy/same-origin frontend and API in production. Keep the frontend independently deployable and GitHub Pages offline build working; do not put secrets in static builds. Document alternatives and any changes to stack, choose boring dependencies and lock versions. No Redis/Kubernetes/microservices yet. 
Suggested structure:
- server/src/{config,auth,accounts,characters,db,protocol,realtime,world}
- shared/{contracts,validation,game-rules-adapter}
- client/{online,auth-ui}
- supabase/migrations (one source of database schema)
- tests/{server,auth,e2e}; docs/server
Follow existing build.sh and source structure; avoid a competing game client. Use an adapter to the existing shared pure rules; do not duplicate character creation constraints. Existing source modules may be script-tag wrappers; extract/import through a tested adapter as necessary without altering offline results.

## 2. Authentication and account management

Use managed identity, never implement custom password hashing or OAuth. Provide email/password registration, email verification, login, reset password, logout and session expiry; optional Google and Sign in with Apple (OAuth/OIDC authorization code flow with PKCE and provider SDK, state/nonce checks as applicable). Provider credentials and allowed redirect URLs configured via environment and dashboard; validate real production callback domains and Apple prerequisites against current official docs. If not configured, hide/disable provider buttons clearly. No mock social login or claims of working provider integration without actual credentials and live end-to-end verification.
Use provider-issued stable user ID as identity, internal UUID account ID; never use email as the primary ID. Handle Apple relay email and providers' missing display names. Review provider account-linking behavior; no unsafe merge by unverified email. Explicit linking should require authenticated reauthorization; preserve existing characters. Handle callback errors, cancelled login, email verification/reset, revoked credentials, expired sessions.
Propose server-side BFF sessions with opaque random session ID in HttpOnly Secure SameSite cookies (local dev exception documented), rotated on login, revocable and expiring; provider refresh credentials encrypted if stored server-side. Do not mix multiple incompatible session systems. Validate token issuer/audience/signature/expiry with official SDK and handle key rotation; never trust client-submitted account ID. Protect cookie-auth mutations against CSRF, enforce strict allowed origins and rate limits, generic auth errors, no tokens/passwords in logs. Reject external open redirects. Avoid long-lived credentials in URLs/localStorage. Admin/service-role keys stay server only; least privilege DB roles and RLS where applicable. Use HTTPS/WSS in production.
Provide account settings: email, display name, linked provider status, logout; account deletion/export design and safe implementation with recent reauth/confirmation, no automatic linking by name. Don't collect unnecessary PII.

## 3. Database and online character lifecycle

Versioned migrations, constraints and transactions. Suggested tables:
- accounts: UUID, unique auth_subject, display_name, status, created_at, updated_at
- characters: UUID, account_id FK, realm_id, canonical unique name within realm, body/appearance, canonical stats/skills, starting town, position, state version, timestamps
- realms: ID, name, status (one realm initially)
- character_state / inventory / equipment / bank as clearly defined versioned persistent records (choose normalized or versioned JSONB with documented validation); reserve stable server-owned item/actor IDs, transactional changes, optimistic version checking.
- sessions (if BFF architecture chosen), minimum security audit events
Keep accounts separate from characters, IDs stable, use migrations not ad-hoc schema edits. Use per-account character slots (proposed 5 configurable), atomic quota and unique-name constraints, soft deletion/recovery policy, no client-submitted initial gear/skill values beyond validated creation choices. Use existing 80 stat points, 3 skills totaling 100, max 50 starting skill, 49 skill framework, 225/700 eventual caps, five starting towns and legitimate starter kit as latest code defines. Server validates and generates initial state and IDs. Never copy gold/items/stats from browser saves. Offline export stays available; online import explicitly unsupported.
Provide protected HTTP endpoints for session/account, list/create/select/delete character, realm list, health/readiness. Use schema validation, ownership checks on every operation (including guessed UUID), transaction-safe creation, idempotency for retries where appropriate. Character deletion uses explicit confirmation and policy. No direct unrestricted client database writes.

## 4. Login UI and flow

Classic medieval Shardfall look, responsive desktop/mobile, usable on iOS Safari. Title screen: Play Online / Play Offline (existing), sign in, create account, Google/Apple when enabled, forgot password, verification status, clear errors and loading states. After login: realm selector (one realm), roster with appearance/name/town, New Character using existing wizard, select/play, delete with confirmation, logout. A character creation wizard submits only legal choices; server sends authoritative result. Keep Offline mode visibly labeled and never overwrite its save. Online roster/connection screen must honestly state gameplay is not yet server-authoritative; do not silently launch an offline game pretending to be online.

## 5. Real-time foundation

Implement authenticated WebSocket upgrade/session check with Origin validation, no long-lived token in URL; if cross-origin transport later needed, issue short-lived single-use tickets. Require ownership of selected character; one active character session per character across tabs, documented takeover/reconnect policy. Protocol version, typed message envelope, request IDs, sequence numbers and payload limits; heartbeat, bounded queues, connection cleanup, disconnect/reconnect, snapshot/version/resync, rate limits and structured logging. Server returns selected character snapshot and presence; demonstrate two separate accounts seeing each other's presence in a minimal alpha session. No client-authoritative move/damage/inventory/gold/skill messages accepted. Reserve server tick boundary (existing simulation uses 50 ms steps) and command/event architecture for later movement and combat; don't port entire world yet. Use a small test lobby only, not a simulated MMO promise.

## 6. Deployment, tests and definition of done

Provide .env.example with placeholders, .gitignore, local Docker/Supabase setup instructions, reproducible dev commands, migration/seed, test fixtures; separate dev/staging/prod DB and OAuth redirect settings. Keep production credentials and private keys outside repo. Provide deployment guide for affordable managed DB/auth plus always-on WebSocket-capable Node host, TLS, backups and recovery, request/connection metrics; no paid resources created automatically. Document that GitHub Pages is static only.
Tests: existing offline suite unchanged; fresh install/migrations; signup/verify/login/reset/logout; invalid/expired/revoked session; two independent accounts cannot access each other's characters via HTTP or WS; name and slot concurrency; create/reload character and server-generated starter kit; forged stats/items rejected; offline save unchanged; CSRF/origin/rate limit; duplicate sessions/reconnect; two-client presence; mobile flow. Test Google/Apple callback plumbing using supported test fixture; actual provider login acceptance is pending credentials and verified redirect setup. Do not skip required tests silently. Run existing checks and new integration tests in CI; document exact commands, results, skips and remaining blockers. Keep branch separate and open PR, include commit SHA, screenshots of login/roster if possible and rollback instructions.
Stop after foundation passes. Next phase is server-owned movement, collision, interest management and synchronization, then combat/skills/inventory/economy one subsystem at a time. Never make this PR a full engine rewrite.
