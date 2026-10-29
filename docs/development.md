# Development guide

How the code is organised, and the rules that keep it consistent.

## Architecture in one paragraph

`apps/web` is the only place that serves HTTP. It resolves the session, calls
a repository in `packages/db` inside a tenant-scoped transaction, and returns
JSON. `packages/backend` holds the code that is not HTTP-specific: env
access, crypto, email, object storage, AI providers and the job pipeline.
`apps/worker` runs the same job pipeline against a Redis queue. `apps/asr` is
an optional local speech-to-text service. `packages/core` holds shared types
plus demo data; `packages/ui` holds the design-system components.

```
browser ──▶ apps/web ──▶ packages/db ──▶ Postgres
                │             │
                │             └──▶ object storage (local or S3)
                ├──▶ packages/backend ──▶ ASR / LLM provider
                └──▶ BullMQ (Redis) ──▶ apps/worker ──▶ packages/backend
```

## Rules

### 1. The canonical SQL is the source of truth

`replica/schema.sql` defines every table, index, trigger and RLS policy.
`packages/db/src/schema.ts` is generated from it:

```bash
pnpm --filter @click/db schema
```

Never hand-edit `schema.ts`. To change the schema, edit `replica/schema.sql`,
copy the change into a new migration in `packages/db/migrations/`, and
regenerate. Migrations are append-only — the migrator refuses to run if an
already-applied file's checksum changed.

### 2. Tenant queries go through `withTenant()`

```ts
import { withTenant } from "@click/db";

const rows = await withTenant({ orgId, userId }, async (tx) => {
  return tx.select().from(meetings);
});
```

`withTenant()` opens a transaction, runs `SET LOCAL ROLE click_app`, and sets
`app.org_id` / `app.user_id`. Every tenant table has row-level security, so a
query without that context sees nothing and a query with the wrong context sees
the wrong tenant's rows.

The raw `db` export exists for the rare case that needs it (the migrator, the
seeder, the CLI) and must not appear in a request handler. Pre-tenant lookups
— login, session resolution, auth-token consumption — use `withAuth()`, which
switches to the `click_auth` role that bypasses RLS.

Add a repository function rather than writing SQL in a route. Repositories
live in `packages/db/src/repositories/`.

### 3. Every route goes through `handler()`

```ts
export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  return json({ ok: true });
});
```

`handler()` gives every response a consistent error shape, a request id, and
`Cache-Control: no-store`, and it guarantees that an unexpected throw returns
a generic message instead of a stack trace. Use `parseJson()` for request
bodies (it validates with zod and enforces the 1 MB limit), `assertSameOrigin()`
on cookie-authenticated mutations, `limit()` for rate limiting, and
`requireOrgSession()` / `requireRole()` for access control.

Add new routes under `apps/web/src/app/api/v1/`. The filesystem is the router.

### 4. Secrets never reach a response

Provider API keys and calendar tokens are encrypted at rest with AES-256-GCM
(`packages/backend/src/crypto.ts`). Never return a stored secret to a client;
return a masked value and a `configured` flag instead, the way
`/api/v1/admin/providers` does.

### 5. Jobs do the slow work

Request handlers stay fast. Anything that takes more than a second —
transcription, summarisation, embedding, sending mail — goes through
`enqueue()` in `packages/backend/src/queue.ts`. With `REDIS_URL` set it goes to
BullMQ and `apps/worker` picks it up; without it, the job runs inline in the
web process so a single-node install still works.

Jobs must be idempotent. `retryMeeting()` can re-run the transcribe or
summarize stage at any time.

### 6. Providers are pluggable and BYOK

A provider is selected by `ASR_PROVIDER` / `LLM_PROVIDER` /
`EMBEDDINGS_ENABLED`, with per-organization overrides in `provider_configs`.
`mock` must always work and must never need a key — it is what makes a fresh
checkout work. Add a new provider by extending the switch in
`packages/backend/src/providers.ts` and adding the settings to `env.ts` and
`.env.example`.

### 7. Never bill

There is no billing in Click, and there will not be. Usage is metered in
`usage_meters` and capped by the operator (`BUDGET_CAP_USD`, or a per-org cap
in `organizations.settings`). A job that would exceed the cap throws
`BudgetExceededError`, which the API surfaces as `402 budget_exceeded`. The
per-unit prices are operator-supplied estimates, not Click prices.

## Testing

```bash
pnpm typecheck
pnpm build
pnpm --filter @click/db test:rls     # needs a migrated database
```

The RLS test creates a throwaway organization and asserts that:

1. a tenant cannot read another tenant's meeting,
2. a tenant cannot read another tenant's meeting list,
3. a tenant sees only its own rows,
4. a cross-tenant insert is rejected,
5. the `organizations` table is scoped too.

CI (`.github/workflows/ci.yml`) runs typecheck, build, migrate, seed, the RLS
test and a health check against `pgvector/pgvector:pg17` and Redis.

There is no browser test suite yet. When you add one, drive it through the
running app rather than mocking the API — the API is the thing most likely to
break.

## Things that are easy to get wrong

- **The schema is not a view.** `packages/db/src/schema.ts` mirrors
  `replica/schema.sql`. If you change one without the other, TypeScript will
  happily compile queries against columns that do not exist.
- **`citext` is `text` in the Drizzle schema.** Emails are case-insensitive in
  the database, so always lowercase before comparing or inserting.
- **Enum columns are typed as `text` in Drizzle.** Postgres still enforces the
  enum, so a bad value fails at runtime, not at compile time. The
  `transcript_status` enum gained a `processing` value for exactly this
  reason.
- **`set_config(..., true)` is transaction-local.** The RLS context only
  exists inside the transaction that set it. Do not move a query outside
  `withTenant()`.
- **The local Postgres in a sandbox may lack pgvector.** Apply a patched copy
  with `MIGRATIONS_DIR` pointing at it; the schema itself is unchanged.
