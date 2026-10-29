# Contributing

Thanks for helping build an open, self-hostable AI meeting assistant.

## Ground rules

1. **Clean room.** Do not copy code, assets, copy text, logos, or design files
   from Fireflies.ai, Granola, Otter.ai or any other product. Build from the
   written contracts in `replica/` and from first principles.
2. **Public sources only.** No reverse engineering, no inspecting private APIs,
   no copying bundled JavaScript, no unlicensed assets.
3. **Own your dependencies.** Any dependency must be OSS-compatible with the
   project licence and must not require a paid service to run the core flow.

## Workflow

1. Open or find an issue before starting on anything larger than a bugfix.
2. Branch from `main`: `feat/short-slug`, `fix/short-slug`, `docs/short-slug`.
3. Keep commits small and readable; write the commit subject in the imperative
   mood ("Add transcript search index").
4. Open a pull request that references the issue and describes how you tested
   it.
5. CI must pass: lint, typecheck, tests, build.

## Commit message style

```
type(scope): short summary

Why this change is needed. What changed. Anything a reviewer should watch out
for.
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `chore`.

## Local development

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL, APP_URL, APP_SECRET
pnpm db:migrate               # apply packages/db/migrations in order
pnpm db:seed                  # optional demo workspace
pnpm dev                      # web on :3000, jobs run inline without Redis
```

You need a Postgres with the `pgvector`, `citext` and `pg_trgm` extensions.
The quickest way is the bundled stack:

```bash
docker compose -f infra/compose/docker-compose.yml up -d db redis minio minio-init
```

Without Docker, any Postgres 16+ works — the schema is in
[`replica/schema.sql`](replica/schema.sql) and the migrations in
`packages/db/migrations/`. If `pgvector` is unavailable, apply a copy with
`vector(1536)` mapped to `jsonb` and the HNSW index skipped by pointing
`MIGRATIONS_DIR` at that directory.

Checks:

```bash
pnpm typecheck
pnpm build
pnpm --filter @click/db test:rls   # needs a migrated database
```

CI runs the same commands against `pgvector/pgvector:pg17` and Redis, plus
migrate, seed and a health check.

More detail in [`docs/development.md`](docs/development.md) — the code layout
and the rules that keep it consistent.

### Layout

| path | what it is |
| --- | --- |
| `apps/web` | Next.js app: UI, `/api/v1` routes, bot callbacks |
| `apps/worker` | BullMQ worker (transcribe, summarize, embed, email) |
| `apps/asr` | local faster-whisper ASR service |
| `packages/db` | Drizzle schema, migrations, RLS-aware client, repositories |
| `packages/backend` | shared server code: env, crypto, mail, storage, providers, jobs |
| `packages/core` | shared types and demo data |
| `packages/ui` | design-system components |
| `replica/` | recon, architecture, schema, design tokens, backend reference |

### Rules that matter

- The canonical DDL is `replica/schema.sql`. `packages/db/src/schema.ts` is
  generated from it (`pnpm --filter @click/db schema`); never hand-edit it.
- Every tenant query goes through `withTenant()` in `packages/db/src/client.ts`.
  It sets the RLS context. Do not use the raw `db` export in request handlers.
- Every API route is wrapped in `handler()` from `apps/web/src/server/http.ts`
  so errors stay consistent and internals never leak.
- New secrets go in `.env` and `.env.example`; never commit a `.env` file.

## Reporting security issues

Do not open a public issue. Follow `SECURITY.md`.
