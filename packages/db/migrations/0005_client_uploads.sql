-- Chunked uploads for the desktop, extension and mobile clients.
--
-- The canonical DDL lives in packages/db/ddl/schema.sql; this migration brings
-- an existing database up to the same shape. A client starts an upload
-- session, sends the recording in numbered chunks and completes the session.
-- The chunk rows make a re-sent chunk idempotent, so a client that lost the
-- connection can resume with the chunks it already sent.

create table if not exists upload_sessions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  meeting_id        uuid references meetings(id) on delete set null,
  title             text not null,
  mime              text not null,
  codec             text not null,
  storage_key       text not null,
  storage_upload_id text,
  chunk_size        integer not null,
  total_bytes       bigint,
  received_bytes    bigint not null default 0,
  state             text not null default 'open'
                      check (state in ('open','completed','aborted')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists upload_sessions_org_idx on upload_sessions (org_id, created_at desc);

create table if not exists upload_chunks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  upload_id   uuid not null references upload_sessions(id) on delete cascade,
  chunk_index integer not null,
  size_bytes  integer not null,
  etag        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists upload_chunks_upload_index_idx
  on upload_chunks (upload_id, chunk_index);

-- RLS for the new tables (the init migration only loops over existing tables).
alter table upload_sessions enable row level security;
drop policy if exists org_isolation on upload_sessions;
create policy org_isolation on upload_sessions
  using (org_id = app_current_org()) with check (org_id = app_current_org());

alter table upload_chunks enable row level security;
drop policy if exists org_isolation on upload_chunks;
create policy org_isolation on upload_chunks
  using (org_id = app_current_org()) with check (org_id = app_current_org());
