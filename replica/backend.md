# Click — Backend

The backend phase of Click. This document records what actually exists in the
repository today: the data model, the HTTP surface, the job pipeline, the
provider contract, the security posture, and the known gaps. It is written
against the code, not against the plan — where the two differ, the code wins
and the difference is listed under "Known gaps".

Status: **implemented and exercised locally**. Postgres + pgvector, session
auth, RBAC/RLS, object storage, ASR/LLM providers, background jobs and email
are all wired. The pieces that are not done are listed explicitly at the end.

---

## 1. Shape of the system

```
apps/web         Next.js 16 app: UI, /api/v1 routes, /internal/v1 bot callbacks
apps/worker      BullMQ worker process (transcribe, summarize, embed, email)
apps/asr         Optional local ASR service (FastAPI + faster-whisper)
packages/db      Drizzle schema, migrations, RLS-aware client, repositories
packages/backend Shared server code: env, crypto, mail, storage, providers, jobs, queue
packages/core    Types + demo data (UI fallback only, never the source of truth)
packages/ui      Design-system components
infra/compose    Postgres+pgvector, Redis, MinIO, web, worker, ASR, Caddy
```

Request flow for a tenant query:

1. The route handler resolves the session cookie to a user + organization.
2. `withTenant({ orgId, userId }, fn)` opens a transaction, runs
   `SET LOCAL ROLE click_app`, and sets `app.org_id` / `app.user_id`.
3. Every tenant table has `org_id`, RLS enabled, and a policy
   `using (org_id = app_current_org()) with check (org_id = app_current_org())`.
4. A query for another organization's id returns zero rows — it cannot even
   reach the row to filter it out.

Pre-tenant lookups (login, session resolution, token consumption) run through
`withAuth()`, which uses the `click_auth` role (`BYPASSRLS`) and is only
reachable through the narrow functions in `packages/db/src/repositories/auth.ts`.

## 2. Data model

- Canonical DDL: [`replica/schema.sql`](../replica/schema.sql) — 64 tables.
- Migrations: `packages/db/migrations/0000_init.sql` (schema) and
  `0001_auth_role.sql` (roles and grants).
- `packages/db/src/schema.ts` is generated from the SQL by
  `packages/db/scripts/generate-schema.mjs`; the SQL stays the source of truth.

Roles:

| role | attributes | used for |
| --- | --- | --- |
| `click` (connection user) | owns the schema | migrations only |
| `click_app` | `NOLOGIN`, RLS applies | every tenant query |
| `click_auth` | `NOLOGIN`, `BYPASSRLS` | login, session, auth-token lookups |

Tables are grouped by concern: tenancy/identity (`organizations`, `users`,
`memberships`, `sessions`, `auth_tokens`, `invitations`), capture (`meetings`,
`meeting_participants`, `recordings`, `transcripts`, `transcript_segments`,
`speakers`), knowledge (`notes`, `note_sections`, `citations`, `action_items`,
`templates`, `folders`, `channels`), integration (`integrations`, `provider_configs`,
`calendar_connections`, `webhooks`, `webhook_deliveries`), and governance
(`usage_meters`, `audit_events`, `consent_records`, `retention_policies`,
`bot_jobs`, `public_shares`).

There is no money anywhere in the schema. `usage_meters` is the spend ledger
and `organizations.settings.ai_budget_cap` is the operator-set ceiling.

## 3. Authentication

Sessions are opaque random tokens. Only a SHA-256 hash of the token is stored
in `sessions`; the raw token lives in the `click_session` cookie, which is
`HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `APP_URL` starts with
`https://`. Passwords use scrypt (`packages/db/src/password.ts`) with a
per-password salt and a constant-time comparison; a dummy hash is used for
unknown emails so login timing does not leak account existence.

Flows implemented:

| flow | route | notes |
| --- | --- | --- |
| register | `POST /api/v1/auth/register` | creates org + owner, sends verification mail |
| login | `POST /api/v1/auth/login` | rate limited, sets session cookie |
| logout | `POST /api/v1/auth/logout` | deletes the session row and clears the cookie |
| current session | `GET /api/v1/auth/session` | returns user + org + role |
| magic link | `POST /api/v1/auth/magic-link`, `POST /api/v1/auth/magic-link/consume` | requires SMTP, or returns a dev link in dev |
| forgot password | `POST /api/v1/auth/forgot-password` | never reveals whether the address exists |
| reset password | `POST /api/v1/auth/reset-password` | consumes a single-use token |
| verify email | `POST /api/v1/auth/verify-email` | single-use token |
| invite accept | `GET /api/v1/invites/[token]`, `POST /api/v1/auth/invite/accept` | public preview, then membership |
| OIDC | `GET /api/v1/auth/oidc/start`, `GET /api/v1/auth/oidc/callback` | discovery + PKCE + `jose` id_token verification |

CLI equivalents live in `packages/db/src/cli.ts`: `create-admin`, `reset-password`,
`verify-email`, `invite`. The CLI path is the supported way to bootstrap an
instance without SMTP.

OIDC uses authorization-code with PKCE, `state` and `nonce` stored in short-lived
httpOnly cookies, and issuer/audience/nonce checks on the id_token.

## 4. HTTP API

All routes live under `apps/web/src/app/api/v1` and are wrapped by
`handler()` (`apps/web/src/server/http.ts`), which gives every response a
consistent error shape, a request id, `Cache-Control: no-store`, and no stack
traces or internal messages. Mutating routes check the `Origin` header against
`APP_URL` when the browser sends one (CSRF defence for cookie auth).

### Auth
| method | path | role |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/logout` | session |
| GET | `/api/v1/auth/session` | public |
| POST | `/api/v1/auth/magic-link` | public |
| POST | `/api/v1/auth/magic-link/consume` | public |
| POST | `/api/v1/auth/forgot-password` | public |
| POST | `/api/v1/auth/reset-password` | public |
| POST | `/api/v1/auth/verify-email` | public |
| POST | `/api/v1/auth/invite/accept` | public |
| GET | `/api/v1/invites/[token]` | public |
| GET | `/api/v1/auth/oidc/start` | public |
| GET | `/api/v1/auth/oidc/callback` | public |

### Workspace
| method | path | role |
| --- | --- | --- |
| GET, PATCH | `/api/v1/org` | member |
| GET | `/api/v1/org/members` | member |
| PATCH | `/api/v1/org/members/[id]` | admin |
| POST | `/api/v1/org/invites` | admin |
| GET | `/api/v1/org/usage` | member |
| GET | `/api/v1/org/audit` | admin |
| GET | `/api/v1/settings/profile` | session |
| PATCH | `/api/v1/settings/profile` | session |
| GET, POST | `/api/v1/folders` | member |
| GET, POST | `/api/v1/channels` | member |

### Meetings and content
| method | path | role |
| --- | --- | --- |
| GET, POST | `/api/v1/meetings` | member |
| GET, PATCH, DELETE | `/api/v1/meetings/[id]` | member |
| POST | `/api/v1/meetings/[id]/restore` | member |
| GET | `/api/v1/meetings/[id]/transcript` | member |
| PATCH | `/api/v1/meetings/[id]/transcript/segments/[segmentId]` | member |
| GET, PUT | `/api/v1/meetings/[id]/notes` | member |
| POST | `/api/v1/meetings/[id]/notes/generate` | member |
| POST | `/api/v1/meetings/[id]/retry` | member |
| POST | `/api/v1/meetings/[id]/consent` | member |
| GET | `/api/v1/meetings/[id]/export` | member |
| POST, DELETE | `/api/v1/meetings/[id]/bot` | member |
| GET | `/api/v1/action-items` | member |
| PATCH, DELETE | `/api/v1/action-items/[id]` | member |
| GET | `/api/v1/search` | member |
| POST | `/api/v1/search/semantic` | member |
| POST | `/api/v1/uploads` | member |
| GET | `/api/v1/uploads/[...key]` | member (signed download) |

### Administration
| method | path | role |
| --- | --- | --- |
| GET | `/api/v1/admin/providers` | admin |
| POST | `/api/v1/admin/providers/test` | admin |
| GET | `/api/healthz` | public |

### Bot callbacks (internal)
`POST /internal/v1/bots/[id]/lifecycle`, `/segments`, `/recording` — each
authenticated with an HMAC signature over the raw body using
`BOT_WEBHOOK_SECRET` (`apps/web/src/server/bot.ts`), with a timestamp to bound
replay.

## 5. Jobs

Four queues: `transcribe`, `summarize`, `embed`, `email`.

With `REDIS_URL` set, jobs go through BullMQ (3 attempts, exponential backoff)
and `apps/worker` runs the workers. Without Redis, the web process runs the
job inline, so `docker compose up` with only Postgres still produces a working
transcript-and-notes flow.

Pipeline for an uploaded recording or a bot recording:

```
upload / bot recording
   -> transcribe   ASR provider -> transcript + transcript_segments + speakers
   -> summarize    LLM provider -> note + note_sections + citations + action_items
   -> embed        embeddings provider -> embeddings rows for semantic search
```

Each stage checks the budget before spending, records estimated usage in
`usage_meters` afterwards, and is individually re-runnable through
`POST /api/v1/meetings/[id]/retry` with `{"stage":"transcribe"|"summarize"}`.

## 6. Providers and BYOK

Providers are configured per organization (`provider_configs` rows) and can be
overridden by environment variables. There is no billing and no Click-hosted
model access.

| kind | providers | notes |
| --- | --- | --- |
| ASR | `mock`, `local` (faster-whisper over `ASR_URL`), `openai` (and any OpenAI-compatible `/audio/transcriptions`) | `mock` returns a deterministic demo transcript so a fresh install works with no keys |
| LLM | `mock`, `openai` (and any OpenAI-compatible `/chat/completions`) | `mock` produces extractive notes with citations |
| Embeddings | `openai`-compatible, disabled by default | needs pgvector |
| Email | SMTP via Nodemailer | without SMTP, mail is written to `.data/mail` and dev links are returned |
| Storage | `local` (`.data/uploads`) or `s3` (MinIO, R2, Backblaze, AWS) | `STORAGE_DRIVER=s3` |

The local ASR service (`apps/asr`) is a small FastAPI wrapper around
faster-whisper. Set `ASR_PROVIDER=local` and `ASR_URL=http://asr:8000`.

Budget: `BUDGET_CAP_USD` (default `50`) plus per-organization overrides in
`organizations.settings.ai_budget_cap`. When the cap is exceeded, jobs stop
with `BudgetExceededError` and the API answers `402 budget_exceeded`. Costs are
operator-supplied estimates (`ASR_COST_PER_MINUTE`, `LLM_INPUT_COST_PER_1K`,
`LLM_OUTPUT_COST_PER_1K`) — Click never sells or bills usage.

Secrets at rest (calendar refresh tokens, provider API keys) are encrypted with
AES-256-GCM using `ENCRYPTION_KEY` (`packages/backend/src/crypto.ts`).

## 7. Storage

`packages/backend/src/storage.ts` exposes `putObject`, `getObject`,
`deleteObject`, `presignDownload` and `readObjectText` over the local or S3
driver. Upload keys are namespaced `org/<orgId>/meeting/<meetingId>/<uuid>.<ext>`
so a key can never cross tenants. The local driver resolves paths under
`STORAGE_DIR` and rejects any key that escapes it.

## 8. Security checklist

- [x] Passwords hashed with scrypt, per-password salt, constant-time compare.
- [x] Session tokens stored hashed; cookie is `HttpOnly` + `SameSite=Lax`, `Secure` under HTTPS.
- [x] Same-origin check on cookie-authenticated mutations.
- [x] Rate limiting on login, registration, magic link, and password reset.
- [x] RLS on every tenant table, verified by an automated test (`packages/db/tests/rls.test.ts`).
- [x] Two database roles: `click_app` (RLS) and `click_auth` (BYPASSRLS, narrow surface).
- [x] Parameterised SQL only (Drizzle / tagged templates).
- [x] Role checks on admin routes (owner/admin/member).
- [x] Audit events written for privileged mutations.
- [x] Secrets encrypted at rest with AES-256-GCM.
- [x] Bot callbacks authenticated with HMAC + timestamp.
- [x] No user data in error responses; no stack traces leak.
- [x] Upload size and MIME allow-list enforced.
- [x] Single-use, expiring tokens for email verification, password reset, magic link, invites.
- [ ] SAML SSO — not implemented (OIDC is).
- [ ] Rate limiting is in-process; a multi-node deployment should move it to Redis.
- [ ] No session revocation UI (sessions can be deleted by the CLI).

## 9. Verification performed

Run locally against PostgreSQL 17 (pgvector unavailable in the sandbox, so the
migrations were applied with `vector(1536)` mapped to `jsonb` and the HNSW
index skipped — the schema itself is unchanged):

- `pnpm typecheck` — clean across all packages.
- `pnpm build` — Next.js standalone build succeeds; all API routes compile.
- `pnpm --filter @click/db test:rls` — asserts cross-org read isolation,
  cross-org write rejection, and organization-table scoping.
- Live smoke test against the dev server with the seeded account
  `ava@click.local`:
  - `POST /api/v1/auth/login` → session cookie; `GET /api/v1/auth/session` → user + org + role.
  - `GET /api/v1/meetings` → 4 meetings, tenant-scoped.
  - `GET /api/v1/meetings/[id]/transcript` → transcript + segments with speakers.
  - `GET /api/v1/meetings/[id]/notes` → note with sections and citations.
  - `POST /api/v1/meetings/[id]/notes/generate` → `202 generating`.
  - `POST /api/v1/uploads` (multipart audio) → meeting + recording, `status: processing`.
  - `POST /api/v1/meetings/[id]/retry {"stage":"transcribe"}` → transcript `ready` with 167 words.
  - `GET /api/v1/search?q=pricing` → keyword hit with snippet.
  - `GET /api/v1/action-items` → items across the tenant.
  - `GET /api/v1/org/usage` → ASR seconds, LLM tokens, cost estimate, budget cap.
  - Unauthenticated `GET /app` → `307` to `/login?next=/app`.
  - Authenticated pages (`/app`, `/app/meetings`, `/app/meetings/[id]`, `/app/search`,
    `/app/import`, `/app/tasks`) → `200` with real API data.

## 10. Configuration

`.env.example` documents every variable. The ones that matter most:

| variable | purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (required) |
| `APP_URL` | public URL; drives cookie `Secure` and the OIDC redirect URI |
| `APP_SECRET` | application secret |
| `ENCRYPTION_KEY` | 32-byte key for AES-256-GCM |
| `BOT_WEBHOOK_SECRET` | HMAC secret for `/internal/v1` callbacks |
| `REDIS_URL` | when set, jobs run on the worker instead of inline |
| `STORAGE_DRIVER` / `STORAGE_DIR` / `S3_*` | object storage |
| `SMTP_*` | outbound email; without it, mail is written to disk in dev |
| `ASR_PROVIDER` / `ASR_URL` / `ASR_API_KEY` / `ASR_MODEL` | speech to text |
| `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | notes and chat |
| `EMBEDDINGS_ENABLED` / `EMBEDDING_*` | semantic search |
| `BUDGET_CAP_USD` | operator spend ceiling |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | SSO |

## 11. Known gaps

1. **SAML SSO** — not implemented. OIDC is the supported path. Adding SAML
   means a new `saml_*` table set and a Jackson/BoxyHQ-compatible service.
2. **Google Meet / Zoom joining** — the bot-side callbacks
   (`/internal/v1/bots/[id]/*`) exist and are authenticated, but no meeting
   provider client is wired yet. That is the next milestone (M2).
3. **Real-time streaming** — transcripts are batch (upload → transcribe →
   summarize). Live segment streaming into `transcript_segments` is designed
   for but not built.
4. **Multi-workspace switching** — a user belongs to one organization in the
   current schema; switching workspaces is not implemented.
5. **Semantic search** — the route and the embeddings job exist, but the
   embeddings table needs pgvector, which is not available in every local
   environment. `EMBEDDINGS_ENABLED=false` by default.
6. **Rate limiting is per process** — move to Redis before running more than
   one web node.
7. **Calendar sync** — the `calendar_connections` table and encrypted-token
   helpers exist; Google/Microsoft OAuth and event polling do not.
8. **Webhooks** — the tables exist and audit events are written, but outgoing
   webhook delivery is not implemented.
9. **No automated browser tests yet** — the API is exercised by the smoke test
   above and by the RLS test; there is no Playwright suite.

## 12. Next milestone (M2 — bot capture)

1. Provider clients for Zoom (RTMS) and Google Meet (Media API), behind the
   existing bot-job and callback tables.
2. A `apps/bot` service that joins, streams audio, and posts lifecycle,
   segment and recording callbacks with the HMAC signature.
3. Live transcript streaming: `transcript_segments` written as they arrive,
   meeting status moving to `live` then `ready`.
4. Consent notice and recording indicator tied to `consent_records`.
