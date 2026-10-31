-- Task-push providers.
--
-- These project tools are connected with a personal API token the workspace
-- brings along (BYOK), so the catalogue rows use 'api_key' instead of
-- 'oauth2' and no Click app has to be registered with the vendor.

insert into integrations (key, name, category, auth_kind, scopes, docs_url) values
  ('clickup','ClickUp','project','api_key','{"tasks:write"}','https://developer.clickup.com'),
  ('trello','Trello','project','api_key','{"cards:write"}','https://developer.atlassian.com/cloud/trello/'),
  ('monday','monday.com','project','api_key','{"items:write"}','https://developer.monday.com')
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  auth_kind = excluded.auth_kind,
  scopes = excluded.scopes,
  docs_url = excluded.docs_url;

update integrations set auth_kind = 'api_key' where key in ('jira','linear','asana');
