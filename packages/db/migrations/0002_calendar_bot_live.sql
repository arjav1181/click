-- Calendar auto-join rules, bot job plumbing and webhook signing secrets.
-- The canonical DDL lives in replica/schema.sql; this migration brings an
-- existing database up to the same shape.

alter table calendar_connections
  add column if not exists auto_join boolean not null default true;

alter table calendar_events
  alter column auto_join drop not null;

create table if not exists calendar_rules (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  connection_id  uuid references calendar_connections(id) on delete cascade,
  title_pattern  text,
  host_pattern   text,
  attendee_email citext,
  auto_join      boolean not null default true,
  priority       integer not null default 100,
  created_at     timestamptz not null default now()
);
create index if not exists calendar_rules_org_idx on calendar_rules (org_id, priority);

alter table bot_jobs
  add column if not exists calendar_event_id uuid references calendar_events(id) on delete set null;
alter table bot_jobs
  add column if not exists provider_config jsonb not null default '{}';
alter table bot_jobs
  add column if not exists consent_notice_sent_at timestamptz;
alter table bot_jobs
  add column if not exists no_show_notified_at timestamptz;

alter table webhook_endpoints
  add column if not exists secret_enc text;

-- RLS for the new table (the init migration only loops over existing tables).
alter table calendar_rules enable row level security;
drop policy if exists org_isolation on calendar_rules;
create policy org_isolation on calendar_rules
  using (org_id = app_current_org()) with check (org_id = app_current_org());
