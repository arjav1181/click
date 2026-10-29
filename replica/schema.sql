-- Click — PostgreSQL 16 schema
-- Extensions: pgcrypto (uuid), vector (semantic search), pg_trgm (fuzzy), citext
-- Conventions:
--   * uuid primary keys, timestamptz in UTC
--   * org_id denormalised onto every tenant-owned row for RLS and index locality
--   * enums for closed sets, check constraints for small sets
--   * soft delete only where the product has a trash (meetings, notes)
--   * money is absent by design: this build has no billing

create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type member_role        as enum ('owner','admin','member');
create type member_status      as enum ('active','invited','deactivated');
create type meeting_source     as enum ('bot','desktop','extension','mobile','web','upload','api');
create type meeting_status     as enum ('scheduled','joining','live','processing','ready','failed');
create type meeting_privacy    as enum ('private','workspace','link');
create type bot_provider       as enum ('zoom','teams','meet','webex','jitsi');
create type bot_state          as enum ('queued','joining','lobby','active','completed','failed','cancelled');
create type transcript_status  as enum ('pending','processing','streaming','ready','failed');
create type note_status        as enum ('draft','generating','ready','failed');
create type task_status        as enum ('open','done','cancelled');
create type share_access       as enum ('link','domain','password');
create type skill_trigger      as enum ('manual','per_meeting','daily','weekly','monthly');
create type run_status         as enum ('queued','running','ready','failed');
create type integration_status as enum ('connected','error','revoked');
create type provider_kind      as enum ('asr','llm','embedding','email','storage');
create type provider_status    as enum ('unconfigured','testing','ok','error');
create type consent_method     as enum ('bot_notice','chat_message','watermark','desktop_indicator','explicit');
create type email_status       as enum ('draft','sending','sent','failed','expired');
create type delivery_status    as enum ('pending','delivered','failed','exhausted');

-- ---------------------------------------------------------------------------
-- tenancy, identity, access
-- ---------------------------------------------------------------------------
create table organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  logo_url         text,
  domain_allowlist text[] not null default '{}',
  settings         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  name          text not null,
  password_hash text,
  email_verified_at timestamptz,
  avatar_url    text,
  locale        text not null default 'en',
  timezone      text not null default 'UTC',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on users (email);

create table auth_identities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  provider   text not null,
  subject    text not null,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (provider, subject)
);
create index on auth_identities (user_id);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip         inet,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id, expires_at desc);

-- Single-use tokens for magic links, password reset and email verification.
-- Stored hashed; the plaintext only ever exists in the email.
create table auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('magic_link','password_reset','email_verify','invite')),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on auth_tokens (user_id, kind, expires_at desc);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       member_role not null default 'member',
  status     member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on memberships (user_id);
create index on memberships (org_id, role);

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  email       citext not null,
  role        member_role not null default 'member',
  token_hash  text not null unique,
  invited_by  uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on invitations (org_id, email);

create table groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  priority    integer not null default 0,
  template_id uuid,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);
create index on group_members (user_id);

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  name         text not null,
  prefix       text not null,
  key_hash     text not null unique,
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on api_keys (org_id, revoked_at);

-- ---------------------------------------------------------------------------
-- calendar and meetings
-- ---------------------------------------------------------------------------
create table calendar_connections (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  provider          text not null check (provider in ('google','microsoft')),
  account_email     citext not null,
  refresh_token_enc text not null,
  sync_cursor       text,
  status            text not null default 'connected'
                    check (status in ('connected','expired','revoked','error')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider, account_email)
);
create index on calendar_connections (org_id, status);

create table calendar_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  connection_id   uuid not null references calendar_connections(id) on delete cascade,
  external_id     text not null,
  title           text,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  organizer_email citext,
  attendees       jsonb not null default '[]',
  meeting_url     text,
  provider        text,
  auto_join       boolean not null default true,
  bot_status      text not null default 'none'
                  check (bot_status in ('none','scheduled','joining','joined','declined','failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (connection_id, external_id),
  constraint calendar_event_positive check (ends_at > starts_at)
);
create index on calendar_events (org_id, starts_at);
create index on calendar_events (org_id, auto_join, starts_at);

create table meetings (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  owner_id          uuid not null references users(id) on delete cascade,
  calendar_event_id uuid references calendar_events(id) on delete set null,
  title             text not null default 'Untitled meeting',
  description       text,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_s        integer,
  language          text not null default 'en',
  source            meeting_source not null,
  status            meeting_status not null default 'scheduled',
  privacy           meeting_privacy not null default 'private',
  consent_state     text not null default 'pending'
                    check (consent_state in ('pending','acknowledged','declined')),
  retention_state   text not null default 'active'
                    check (retention_state in ('active','held','expired','deleted')),
  failure_reason    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on meetings (org_id, created_at desc) where deleted_at is null;
create index on meetings (org_id, status) where deleted_at is null;
create index on meetings (owner_id, created_at desc);
create index on meetings (calendar_event_id);
create index on meetings using gin (title gin_trgm_ops);

create table meeting_participants (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  meeting_id   uuid not null references meetings(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  display_name text,
  email        citext,
  speaker_id   uuid,
  joined_at    timestamptz,
  left_at      timestamptz,
  is_organizer boolean not null default false
);
create index on meeting_participants (meeting_id);
create index on meeting_participants (org_id, email);

create table bot_jobs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  meeting_id      uuid not null references meetings(id) on delete cascade,
  provider        bot_provider not null,
  meeting_url     text not null,
  bot_name        text not null default 'Click Notetaker',
  state           bot_state not null default 'queued',
  attempts        integer not null default 0,
  lobby_reason    text,
  error_code      text,
  idempotency_key text not null unique,
  scheduled_at    timestamptz not null default now(),
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on bot_jobs (org_id, state, scheduled_at);
create index on bot_jobs (meeting_id);
-- only one live bot per meeting
create unique index one_active_bot_per_meeting
  on bot_jobs (meeting_id)
  where state in ('queued','joining','lobby','active');

create table recordings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  meeting_id  uuid not null references meetings(id) on delete cascade,
  storage_key text not null,
  kind        text not null check (kind in ('audio','video','screen')),
  codec       text,
  duration_s  integer,
  size_bytes  bigint,
  checksum    text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on recordings (meeting_id);
create index on recordings (org_id, deleted_at);

-- ---------------------------------------------------------------------------
-- transcription
-- ---------------------------------------------------------------------------
create table transcripts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  meeting_id     uuid not null references meetings(id) on delete cascade,
  language       text not null default 'en',
  provider       text,
  model          text,
  status         transcript_status not null default 'pending',
  word_count     integer not null default 0,
  confidence_avg numeric(4,3),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (meeting_id)
);
create index on transcripts (org_id, status);

create table speakers (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  name              text,
  email             citext,
  is_me             boolean not null default false,
  voice_profile_ref text,
  merged_into_id    uuid references speakers(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on speakers (org_id, email);
create index on speakers (merged_into_id);

create table transcript_segments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  transcript_id uuid not null references transcripts(id) on delete cascade,
  idx          integer not null,
  speaker_id   uuid references speakers(id) on delete set null,
  start_ms     integer not null,
  end_ms       integer not null,
  text         text not null,
  raw_text     text,
  edited       boolean not null default false,
  confidence   numeric(4,3),
  sentiment    numeric(3,2),
  flags        jsonb not null default '{}',
  search_tsv   tsvector generated always as (to_tsvector('simple', coalesce(text,''))) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (transcript_id, idx),
  constraint segment_time_order check (end_ms >= start_ms)
);
create index on transcript_segments (transcript_id, start_ms);
create index on transcript_segments (org_id, speaker_id);
create index on transcript_segments using gin (search_tsv);
create index on transcript_segments using gin (text gin_trgm_ops);

create table vocabulary_terms (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,
  term       text not null,
  kind       text not null default 'term' check (kind in ('name','term','acronym')),
  created_at timestamptz not null default now()
);
create unique index vocabulary_scope_unique
  on vocabulary_terms (org_id, lower(term), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table embeddings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  object_type text not null check (object_type in ('segment','note_section','meeting')),
  object_id   uuid not null,
  model       text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now(),
  unique (object_type, object_id, model)
);
create index on embeddings using hnsw (embedding vector_cosine_ops);
create index on embeddings (org_id, object_type);

-- ---------------------------------------------------------------------------
-- notes, templates, automation
-- ---------------------------------------------------------------------------
create table templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  owner_id    uuid references users(id) on delete cascade,
  name        text not null,
  description text,
  sections    jsonb not null default '[]',
  prompt      text,
  scope       text not null default 'personal'
              check (scope in ('personal','group','workspace','builtin')),
  is_builtin  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on templates (org_id, scope);

alter table groups
  add constraint groups_template_fk
  foreign key (template_id) references templates(id) on delete set null;

create table notes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  meeting_id        uuid not null references meetings(id) on delete cascade,
  author_id         uuid not null references users(id) on delete cascade,
  raw_markdown      text not null default '',
  enhanced_markdown text,
  status            note_status not null default 'draft',
  template_id       uuid references templates(id) on delete set null,
  model             text,
  generated_at      timestamptz,
  edited_at         timestamptz,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (meeting_id, author_id)
);
create index on notes (org_id, meeting_id);

create table note_sections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  note_id       uuid not null references notes(id) on delete cascade,
  key           text not null,
  title         text not null,
  body_markdown text not null default '',
  order_index   integer not null default 0,
  source        text not null default 'ai' check (source in ('template','ai','custom')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (note_id, key)
);
create index on note_sections (note_id, order_index);

create table citations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  note_id    uuid not null references notes(id) on delete cascade,
  section_id uuid references note_sections(id) on delete cascade,
  segment_id uuid references transcript_segments(id) on delete set null,
  quote      text not null,
  start_ms   integer,
  origin     text not null default 'ai' check (origin in ('human','ai')),
  label      text,
  created_at timestamptz not null default now()
);
create index on citations (note_id);
create index on citations (segment_id);

create table recipes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  owner_id   uuid not null references users(id) on delete cascade,
  name       text not null,
  prompt     text not null,
  scope      text not null default 'single' check (scope in ('single','multi')),
  model      text,
  visibility text not null default 'private'
             check (visibility in ('private','workspace','link')),
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recipes (org_id, visibility);

create table skills (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  recipe_id       uuid not null references recipes(id) on delete cascade,
  trigger         skill_trigger not null default 'manual',
  target_filter   jsonb not null default '{}',
  output_targets  jsonb not null default '[]',
  enabled         boolean not null default true,
  last_run_at     timestamptz,
  created_by      uuid not null references users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on skills (org_id, enabled, trigger);

create table skill_runs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  skill_id        uuid not null references skills(id) on delete cascade,
  meeting_ids     uuid[] not null default '{}',
  status          run_status not null default 'queued',
  output_markdown text,
  error           text,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on skill_runs (org_id, created_at desc);
create index on skill_runs (skill_id, status);

-- ---------------------------------------------------------------------------
-- conversation, actions, collaboration
-- ---------------------------------------------------------------------------
create table chat_threads (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  scope      text not null default 'global'
             check (scope in ('global','folder','channel','meeting','person','company','selection')),
  scope_ids  uuid[] not null default '{}',
  mode       text not null default 'chat' check (mode in ('chat','work')),
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on chat_threads (org_id, user_id, updated_at desc);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  thread_id  uuid not null references chat_threads(id) on delete cascade,
  role       text not null check (role in ('user','assistant','tool','system')),
  content    text not null,
  model      text,
  tokens_in  integer not null default 0,
  tokens_out integer not null default 0,
  citations  jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index on chat_messages (thread_id, created_at);

create table action_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  meeting_id        uuid not null references meetings(id) on delete cascade,
  owner_user_id     uuid references users(id) on delete set null,
  assignee_name     text,
  text              text not null,
  status            task_status not null default 'open',
  due_at            timestamptz,
  source_segment_id uuid references transcript_segments(id) on delete set null,
  pushed_refs       jsonb not null default '[]',
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on action_items (org_id, status, due_at);
create index on action_items (meeting_id);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  meeting_id  uuid not null references meetings(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  segment_id  uuid references transcript_segments(id) on delete set null,
  parent_id   uuid references comments(id) on delete cascade,
  body        text not null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on comments (meeting_id, created_at);
create index on comments (parent_id);

create table highlights (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  segment_id uuid not null references transcript_segments(id) on delete cascade,
  color      text not null default 'yellow',
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id, segment_id)
);

create table bookmarks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  segment_id uuid references transcript_segments(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);
create index on bookmarks (meeting_id, user_id);

create table soundbites (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  meeting_id     uuid not null references meetings(id) on delete cascade,
  created_by     uuid not null references users(id) on delete cascade,
  start_ms       integer not null,
  end_ms         integer not null,
  title          text,
  storage_key    text,
  auto_generated boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint soundbite_time_order check (end_ms > start_ms)
);
create index on soundbites (meeting_id);

create table playlists (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  owner_id   uuid not null references users(id) on delete cascade,
  name       text not null,
  visibility text not null default 'private'
             check (visibility in ('private','workspace','link')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playlist_items (
  playlist_id uuid not null references playlists(id) on delete cascade,
  soundbite_id uuid not null references soundbites(id) on delete cascade,
  position    integer not null default 0,
  primary key (playlist_id, soundbite_id)
);

-- ---------------------------------------------------------------------------
-- organisation surface
-- ---------------------------------------------------------------------------
create table spaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  icon        text,
  description text,
  kind        text not null default 'team' check (kind in ('personal','team','custom')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on spaces (org_id, kind);

create table folders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  space_id    uuid references spaces(id) on delete cascade,
  parent_id   uuid references folders(id) on delete cascade,
  name        text not null,
  icon        text,
  description text,
  owner_id    uuid not null references users(id) on delete cascade,
  link_access text not null default 'members'
              check (link_access in ('members','workspace','link')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on folders (org_id, space_id);
create index on folders (parent_id);

create table folder_members (
  folder_id uuid not null references folders(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  primary key (folder_id, user_id)
);
create index on folder_members (user_id);

create table space_members (
  space_id uuid not null references spaces(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  primary key (space_id, user_id)
);
create index on space_members (user_id);

create table channels (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  visibility  text not null default 'public' check (visibility in ('public','private')),
  description text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  primary key (channel_id, user_id)
);
create index on channel_members (user_id);

create table companies (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,
  domain     text,
  logo_url   text,
  enrichment jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (org_id, domain)
);

create table people (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  email       citext,
  title       text,
  company_id  uuid references companies(id) on delete set null,
  avatar_url  text,
  enrichment  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on people (org_id, email);

create table tags (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name   text not null,
  color  text,
  unique (org_id, name)
);

create table meeting_folders (
  meeting_id uuid not null references meetings(id) on delete cascade,
  folder_id  uuid not null references folders(id) on delete cascade,
  added_by   uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, folder_id)
);
create index on meeting_folders (folder_id);

create table meeting_channels (
  meeting_id uuid not null references meetings(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  shared_by  uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, channel_id)
);
create index on meeting_channels (channel_id);

create table meeting_tags (
  meeting_id uuid not null references meetings(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (meeting_id, tag_id)
);
create index on meeting_tags (tag_id);

-- ---------------------------------------------------------------------------
-- integrations, webhooks, outbound
-- ---------------------------------------------------------------------------
create table integrations (
  id        uuid primary key default gen_random_uuid(),
  key       text not null unique,
  name      text not null,
  category  text not null,
  auth_kind text not null check (auth_kind in ('oauth2','api_key','webhook','none')),
  scopes    text[] not null default '{}',
  docs_url  text
);

create table integration_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  integration_key text not null references integrations(key) on delete cascade,
  credentials_enc text,
  config          jsonb not null default '{}',
  status          integration_status not null default 'connected',
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, integration_key, user_id)
);
create index on integration_connections (org_id, status);

create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  url         text not null,
  secret_hash text not null,
  events      text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on webhook_endpoints (org_id, active);

create table webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  endpoint_id   uuid not null references webhook_endpoints(id) on delete cascade,
  event_id      uuid not null,
  event         text not null,
  payload       jsonb not null,
  status        delivery_status not null default 'pending',
  attempts      integer not null default 0,
  response_code integer,
  next_retry_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (endpoint_id, event_id)
);
create index on webhook_deliveries (status, next_retry_at);

create table email_drafts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  meeting_id      uuid not null references meetings(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  to_addrs        text[] not null default '{}',
  cc_addrs        text[] not null default '{}',
  bcc_addrs       text[] not null default '{}',
  subject         text not null default '',
  body            text not null default '',
  attachments     jsonb not null default '[]',
  status          email_status not null default 'draft',
  expires_at      timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on email_drafts (meeting_id, user_id);

create table briefs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  meeting_id   uuid not null references meetings(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  bullets      jsonb not null default '[]',
  sources      jsonb not null default '[]',
  feedback     integer,
  generated_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

-- ---------------------------------------------------------------------------
-- governance, privacy, metering
-- ---------------------------------------------------------------------------
create table retention_policies (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null unique references organizations(id) on delete cascade,
  transcript_days       integer check (transcript_days is null or transcript_days between 1 and 3650),
  audio_days            integer check (audio_days is null or audio_days between 0 and 3650),
  recording_mode        text not null default 'audio'
                        check (recording_mode in ('audio','audio_video','transcript_only')),
  legal_hold_override   boolean not null default false,
  updated_by            uuid references users(id) on delete set null,
  updated_at            timestamptz not null default now()
);

create table legal_holds (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  name           text not null,
  description    text,
  custodian_ids  uuid[] not null default '{}',
  scope          jsonb not null default '{}',
  released_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index on legal_holds (org_id, released_at);

create table consent_records (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  meeting_id      uuid not null references meetings(id) on delete cascade,
  method          consent_method not null,
  acknowledged_by uuid references users(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  note            text,
  unique (meeting_id, method)
);
create index on consent_records (org_id, meeting_id);

create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  actor_id    uuid references users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb not null default '{}',
  ip          inet,
  created_at  timestamptz not null default now()
);
create index on audit_events (org_id, created_at desc);
create index on audit_events (org_id, action);

create table usage_meters (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  period_start   timestamptz not null,
  period_end     timestamptz not null,
  asr_seconds    bigint not null default 0,
  llm_tokens_in  bigint not null default 0,
  llm_tokens_out bigint not null default 0,
  cost_estimate  numeric(12,4) not null default 0,
  budget_cap     numeric(12,4),
  unique (org_id, period_start)
);
create index on usage_meters (org_id, period_start desc);

create table provider_configs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  kind        provider_kind not null,
  provider    text not null,
  base_url    text,
  api_key_enc text,
  model       text,
  options     jsonb not null default '{}',
  is_default  boolean not null default false,
  status      provider_status not null default 'unconfigured',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, kind, provider)
);
create unique index one_default_provider_per_kind
  on provider_configs (org_id, kind) where is_default;

create table storage_objects (
  key          text primary key,
  org_id       uuid not null references organizations(id) on delete cascade,
  meeting_id   uuid references meetings(id) on delete cascade,
  kind         text not null check (kind in ('audio','video','screen','clip','export','snapshot')),
  size_bytes   bigint,
  content_type text,
  encryption   text not null default 'sse-s3',
  created_at   timestamptz not null default now()
);
create index on storage_objects (org_id, meeting_id);

create table public_shares (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  meeting_id    uuid not null references meetings(id) on delete cascade,
  token_hash    text not null unique,
  access        share_access not null default 'link',
  password_hash text,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public_shares (meeting_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      'trg_' || t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- row level security
-- Every tenant table carries org_id, so one policy shape covers all of them.
-- The app sets: select set_config('app.org_id', $1, true) per request.
-- Auth/session lookups run through the click_auth role, which bypasses RLS.
-- ---------------------------------------------------------------------------
create or replace function app_current_org() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

alter table organizations enable row level security;
create policy org_self on organizations
  using (id = app_current_org())
  with check (id = app_current_org());

do $$
declare t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'org_id'
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy org_isolation on %I using (org_id = app_current_org()) with check (org_id = app_current_org())',
      t);
  end loop;
end $$;

-- users: a user can see themselves and people in their current org
alter table users enable row level security;
create policy users_self on users
  for select
  using (
    id = nullif(current_setting('app.user_id', true), '')::uuid
    or exists (
      select 1 from memberships m
      where m.user_id = users.id and m.org_id = app_current_org()
    )
  );
create policy users_self_update on users
  for update
  using (id = nullif(current_setting('app.user_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.user_id', true), '')::uuid);

-- memberships is covered by the org_isolation policy from the loop above.

-- ---------------------------------------------------------------------------
-- reporting views
-- security_invoker makes the view run with the caller's rights, so RLS on the
-- underlying tables still applies. Without it a view runs as its owner and
-- leaks every tenant's rows.
-- ---------------------------------------------------------------------------
create view v_meeting_overview with (security_invoker = true) as
select
  m.id,
  m.org_id,
  m.owner_id,
  m.title,
  m.started_at,
  m.duration_s,
  m.status,
  m.privacy,
  t.language,
  t.word_count,
  (select count(*) from transcript_segments s where s.transcript_id = t.id) as segment_count,
  (select count(*) from action_items a where a.meeting_id = m.id and a.status = 'open') as open_actions,
  (select count(*) from comments c where c.meeting_id = m.id) as comment_count
from meetings m
left join transcripts t on t.meeting_id = m.id
where m.deleted_at is null;

create view v_org_usage with (security_invoker = true) as
select
  org_id,
  date_trunc('month', period_start) as month,
  sum(asr_seconds) as asr_seconds,
  sum(llm_tokens_in) as tokens_in,
  sum(llm_tokens_out) as tokens_out,
  sum(cost_estimate) as cost,
  max(budget_cap) as budget
from usage_meters
group by org_id, date_trunc('month', period_start);

-- ---------------------------------------------------------------------------
-- seed: built-in summary templates and integration catalogue
-- ---------------------------------------------------------------------------
insert into templates (name, description, sections, prompt, scope, is_builtin)
values
  ('General meeting', 'Overview, decisions, actions and open questions.',
   '[{"key":"overview","title":"Overview"},{"key":"decisions","title":"Decisions"},{"key":"actions","title":"Action items"},{"key":"questions","title":"Open questions"}]',
   'Summarise the meeting. Use only facts present in the transcript. Put decisions and action items in their own sections.', 'builtin', true),
  ('One-to-one', 'A private 1:1 note: wins, blockers, feedback, next steps.',
   '[{"key":"wins","title":"Wins"},{"key":"blockers","title":"Blockers"},{"key":"feedback","title":"Feedback"},{"key":"next","title":"Next steps"}]',
   'Write a concise one-to-one note. Be specific and neutral, and do not invent feedback.', 'builtin', true),
  ('Sales call', 'Pain, budget, decision makers, objections, next step.',
   '[{"key":"context","title":"Context"},{"key":"pain","title":"Pain points"},{"key":"objections","title":"Objections"},{"key":"next","title":"Next step"}]',
   'Extract commercial detail from the call. Quote the customer where possible and mark anything unclear.', 'builtin', true),
  ('Standup', 'Yesterday, today, blockers.',
   '[{"key":"yesterday","title":"Yesterday"},{"key":"today","title":"Today"},{"key":"blockers","title":"Blockers"}]',
   'Produce a per-person standup update. Keep it under 150 words.', 'builtin', true),
  ('Interview', 'Candidate signal against the role, with evidence.',
   '[{"key":"signal","title":"Signal"},{"key":"evidence","title":"Evidence"},{"key":"risks","title":"Risks"},{"key":"next","title":"Next step"}]',
   'Summarise interview evidence without guessing protected characteristics. Cite timestamps.', 'builtin', true);

insert into integrations (key, name, category, auth_kind, scopes, docs_url) values
  ('slack','Slack','communication','oauth2','{"chat:write","channels:read"}','https://api.slack.com'),
  ('notion','Notion','docs','oauth2','{"insertContent"}','https://developers.notion.com'),
  ('hubspot','HubSpot','crm','oauth2','{"crm.objects.contacts.write"}','https://developers.hubspot.com'),
  ('salesforce','Salesforce','crm','oauth2','{"api"}','https://developer.salesforce.com'),
  ('jira','Jira','project','oauth2','{"write:jira-work"}','https://developer.atlassian.com'),
  ('linear','Linear','project','oauth2','{"issues:create"}','https://developers.linear.app'),
  ('asana','Asana','project','oauth2','{"tasks:write"}','https://developers.asana.com'),
  ('google_drive','Google Drive','storage','oauth2','{"drive.file"}','https://developers.google.com/drive'),
  ('webhook','Generic webhook','automation','webhook','{}',null);

-- ---------------------------------------------------------------------------
-- RLS for join tables and auth tables (no org_id column of their own)
-- ---------------------------------------------------------------------------
alter table group_members enable row level security;
create policy group_members_org on group_members
  using (exists (select 1 from groups g where g.id = group_id and g.org_id = app_current_org()))
  with check (exists (select 1 from groups g where g.id = group_id and g.org_id = app_current_org()));

alter table folder_members enable row level security;
create policy folder_members_org on folder_members
  using (exists (select 1 from folders f where f.id = folder_id and f.org_id = app_current_org()))
  with check (exists (select 1 from folders f where f.id = folder_id and f.org_id = app_current_org()));

alter table space_members enable row level security;
create policy space_members_org on space_members
  using (exists (select 1 from spaces s where s.id = space_id and s.org_id = app_current_org()))
  with check (exists (select 1 from spaces s where s.id = space_id and s.org_id = app_current_org()));

alter table channel_members enable row level security;
create policy channel_members_org on channel_members
  using (exists (select 1 from channels c where c.id = channel_id and c.org_id = app_current_org()))
  with check (exists (select 1 from channels c where c.id = channel_id and c.org_id = app_current_org()));

alter table meeting_folders enable row level security;
create policy meeting_folders_org on meeting_folders
  using (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()))
  with check (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()));

alter table meeting_channels enable row level security;
create policy meeting_channels_org on meeting_channels
  using (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()))
  with check (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()));

alter table meeting_tags enable row level security;
create policy meeting_tags_org on meeting_tags
  using (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()))
  with check (exists (select 1 from meetings m where m.id = meeting_id and m.org_id = app_current_org()));

alter table playlist_items enable row level security;
create policy playlist_items_org on playlist_items
  using (exists (select 1 from playlists p where p.id = playlist_id and p.org_id = app_current_org()))
  with check (exists (select 1 from playlists p where p.id = playlist_id and p.org_id = app_current_org()));

alter table sessions enable row level security;
create policy sessions_self on sessions
  using (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

alter table auth_identities enable row level security;
create policy auth_identities_self on auth_identities
  using (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

alter table auth_tokens enable row level security;
create policy auth_tokens_self on auth_tokens
  using (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

-- global catalogue: readable by any authenticated session, writable only by migrations
alter table integrations enable row level security;
create policy integrations_read on integrations for select using (true);

-- built-in templates have no org; they are readable by every workspace
create policy templates_builtin on templates
  for select
  using (org_id is null and is_builtin);
