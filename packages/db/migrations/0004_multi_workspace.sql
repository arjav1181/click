-- Account-wide active workspace.
--
-- A user can belong to several workspaces. users.active_org_id pins the one
-- that sessions resolve to, so the choice follows the account across
-- browsers and devices.
alter table users
  add column if not exists active_org_id uuid references organizations(id) on delete set null;

create index if not exists users_active_org_id_idx on users (active_org_id);

-- Existing accounts land on their newest membership.
update users u
set active_org_id = m.org_id
from (
  select distinct on (user_id) user_id, org_id
  from memberships
  where status = 'active'
  order by user_id, created_at desc
) m
where u.id = m.user_id and u.active_org_id is null;
