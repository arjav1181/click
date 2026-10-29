-- Database roles.
--
-- click_app   the role every tenant query runs as. RLS applies (no bypassrls).
-- click_auth  used only for login/session lookups that happen before a tenant
--             is known. It bypasses RLS, so it can read users/sessions/tokens
--             but only through the narrow repository functions in
--             packages/db/src/repositories/auth.ts.
--
-- The connection user (the migration owner) keeps ownership of the schema and
-- is never used by request handlers directly.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'click_app') then
    create role click_app nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'click_auth') then
    create role click_auth nologin bypassrls;
  end if;
end $$;

grant click_app, click_auth to current_user;

grant usage on schema public to click_app, click_auth;
grant select, insert, update, delete on all tables in schema public to click_app, click_auth;
grant usage, select on all sequences in schema public to click_app, click_auth;
grant execute on all functions in schema public to click_app, click_auth;

-- Tables added by later migrations get the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to click_app, click_auth;
alter default privileges in schema public
  grant usage, select on sequences to click_app, click_auth;
alter default privileges in schema public
  grant execute on functions to click_app, click_auth;
