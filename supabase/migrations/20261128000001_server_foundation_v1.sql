-- Shardfall Server Foundation v1 — the online game schema.
-- One source of database schema: this folder. Applied by `supabase db reset` / `supabase start` (Supabase CLI) or by
-- `npm run migrate` (server/src/db/migrate.ts, which skips files the Supabase CLI has already recorded).
-- Identity lives in Supabase Auth (schema auth, managed by Supabase). Everything the game owns lives in schema game.
-- Nothing here is reachable through the Supabase Data API: the schema is not exposed, RLS is on with no policies, and the
-- anon / authenticated roles get no privileges. Only the game server (DATABASE_URL) reads and writes it.

create schema if not exists game;

-- Realms (shards). One realm to start; the roster and every character are per realm.
create table game.realms (
  id text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  name text not null check (char_length(name) between 2 and 40),
  status text not null default 'open' check (status in ('open', 'locked', 'offline')),
  max_characters_per_account smallint not null default 5 check (max_characters_per_account between 1 and 20),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
insert into game.realms (id, name, status) values ('anniabreen', 'Anniabreen', 'open');

-- Accounts. auth_subject is the provider-issued stable user id (Supabase Auth user id), never the email.
create table game.accounts (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique check (char_length(auth_subject) between 1 and 128),
  display_name text check (display_name is null or char_length(display_name) between 2 and 32),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  character_slots smallint not null default 5 check (character_slots between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Server-side sessions (BFF). The browser holds only an opaque random id in an HttpOnly cookie; the table stores its SHA-256.
-- provider_tokens: the Supabase Auth access and refresh tokens, AES-256-GCM encrypted with SESSION_ENCRYPTION_KEY.
create table game.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  account_id uuid not null references game.accounts (id) on delete cascade,
  kind text not null default 'full' check (kind in ('full', 'recovery')),
  csrf_token text not null,
  provider_tokens bytea not null,
  provider_checked_at timestamptz not null default now(),
  authenticated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text
);
create index sessions_account_idx on game.sessions (account_id) where revoked_at is null;

-- Short-lived PKCE flows (email confirmation, password recovery, Google / Apple sign-in, identity linking, re-authentication).
-- The browser holds the flow id in an HttpOnly cookie; the code verifier never leaves the server.
create table game.auth_flows (
  id_hash bytea primary key,
  kind text not null check (kind in ('signup', 'recovery', 'oauth', 'link', 'reauth')),
  provider text check (provider is null or provider in ('email', 'google', 'apple')),
  code_verifier bytea not null,
  account_id uuid references game.accounts (id) on delete cascade,
  session_id uuid references game.sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Characters. Everything here is generated or validated by the server; nothing is copied from a browser save.
-- name_key: the canonical form names are unique by (lower case, single spaces). A deleted character keeps its name reserved
-- until purged (recovery window); it no longer uses a roster slot.
create table game.characters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references game.accounts (id) on delete cascade,
  realm_id text not null references game.realms (id),
  name text not null check (char_length(name) between 2 and 16),
  name_key text not null check (char_length(name_key) between 2 and 16),
  body text not null check (body in ('male', 'female')),
  appearance jsonb not null check (jsonb_typeof(appearance) = 'object'),
  str smallint not null check (str between 1 and 100),
  dex smallint not null check (dex between 1 and 100),
  int smallint not null check (int between 1 and 100),
  stat_locks jsonb not null check (jsonb_typeof(stat_locks) = 'object'),
  skills jsonb not null check (jsonb_typeof(skills) = 'object'),
  skill_pool integer not null default 0 check (skill_pool >= 0),
  template text not null,
  starting_town text not null check (starting_town in ('quay', 'vespar', 'mynoc', 'skara', 'moonglen')),
  bound_shrine text not null,
  hp integer not null check (hp >= 0),
  stam integer not null check (stam >= 0),
  mana integer not null check (mana >= 0),
  position jsonb not null check (jsonb_typeof(position) = 'object'),
  hotbar jsonb not null check (jsonb_typeof(hotbar) = 'array'),
  rules_version jsonb not null check (jsonb_typeof(rules_version) = 'object'),
  state_version integer not null default 1 check (state_version >= 1),
  creation_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_played_at timestamptz,
  deleted_at timestamptz,
  purge_after timestamptz,
  check ((deleted_at is null) = (purge_after is null))
);
create unique index characters_realm_name_key on game.characters (realm_id, name_key);
-- a retried creation (same Idempotency-Key) returns the character it already made
create unique index characters_creation_key on game.characters (account_id, creation_key) where creation_key is not null;
create index characters_account_idx on game.characters (account_id, realm_id) where deleted_at is null;

-- Items: one row per item instance, a server-owned UUID each. container 'equip' rows carry the slot they are worn in.
-- props: the remaining item fields the shared rules use (material, durability, exceptional, spells, starter …), validated
-- by the server before they are written.
create table game.items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references game.characters (id) on delete cascade,
  container text not null check (container in ('pack', 'bank', 'equip')),
  slot text check ((container = 'equip') = (slot is not null)),
  position smallint not null default 0,
  item_def text not null check (item_def ~ '^[a-z0-9_]{1,40}$'),
  qty integer not null check (qty between 1 and 1000000000),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
  state_version integer not null default 1 check (state_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index items_equip_slot on game.items (character_id, slot) where container = 'equip';
create index items_character_idx on game.items (character_id, container, position);

-- Reserved for later phases: server-owned actor ids (NPCs, creatures, corpses). Allocated by the world server.
create sequence game.actor_id_seq as bigint start with 1000000;

-- Minimum security audit trail. No passwords, tokens or email bodies are ever written here.
create table game.audit_events (
  id bigint generated always as identity primary key,
  account_id uuid references game.accounts (id) on delete set null,
  kind text not null check (char_length(kind) between 3 and 48),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_account_idx on game.audit_events (account_id, created_at desc);

-- Keep the game schema private: RLS on with no policies, nothing granted to the Data API roles (they exist on Supabase only).
alter table game.realms enable row level security;
alter table game.accounts enable row level security;
alter table game.sessions enable row level security;
alter table game.auth_flows enable row level security;
alter table game.characters enable row level security;
alter table game.items enable row level security;
alter table game.audit_events enable row level security;
revoke all on schema game from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema game from %I', r);
      execute format('revoke all on all tables in schema game from %I', r);
      execute format('revoke all on all sequences in schema game from %I', r);
    end if;
  end loop;
end $$;
