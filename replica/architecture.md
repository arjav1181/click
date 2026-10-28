# Architecture: Click (a rebuild of Fireflies.ai + Granola + Otter.ai core features)

Status: planning. Source of truth for scope is `replica/recon.md`; parity is
tracked in `replica/features.csv`. This document decides the stack, the schema,
the API, the meeting-join strategy and the build order.

Working name: **Click**. Trademark note: "Click" is a crowded software mark
(ClickUp, ClickHouse, Click payment). It is fine as a working name; a
trademark/domain/handle sweep is a launch gate before the public repo and the
marketing site go live.

## Stack

Self-hosted first, BYOK, no billing. One deployable, one database, no
microservices. The bot and the ASR worker are the only separate processes, and
only because they have different runtime needs (a browser and a GPU).

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 16 (App Router) + TypeScript + React 19 | server components for the library, route handlers for the API, one language across web and bot |
| styling | Tailwind 4 + design tokens from `replica/design` | fast, themeable, no component-library lock-in |
| database | PostgreSQL 16 + pgvector | relational core + semantic search in one service; RLS built in |
| ORM | Drizzle ORM + drizzle-kit | SQL-first, typed, good with RLS, pgvector and generated columns |
| auth | Auth.js v5 (Credentials + OIDC) + BoxyHQ Jackson for SAML | email/password, magic link, OIDC and SAML without a hosted identity service |
| jobs | BullMQ on Redis 7 | retries, backoff, delayed jobs, repeatable jobs; already familiar |
| files | S3-compatible (MinIO in compose, any S3 in prod) | self-hostable, presigned uploads, lifecycle rules |
| email | Nodemailer over SMTP; optional Resend API | every self-hoster has SMTP; no vendor required |
| ASR | pluggable: local faster-whisper (default), Deepgram, AssemblyAI, Groq, OpenAI-compatible | a fresh install needs no API key; quality can be bought later |
| LLM | pluggable via Vercel AI SDK: OpenAI, Anthropic, Ollama, vLLM, OpenRouter, OpenAI-compatible | BYOK, local models supported, one interface |
| realtime | SSE for transcript/chat streams; Redis pub/sub fan-out | survives proxies, no sticky sessions, simpler than sockets |
| desktop | Electron + TypeScript (Tauri later) | system-audio capture and screen permissions are the hard part; Electron has the mature APIs |
| extension | Manifest V3 + React | tab audio and in-page captions |
| mobile | Expo (React Native) | one codebase, P4 |
| bot | Node/TS worker + Playwright (Meet browser adapter) + provider adapters | browser automation is the only universal Meet path; official APIs are preferred where they exist |
| hosting | Docker Compose (primary), Helm chart (later) | `docker compose up` is the OSS promise |
| payments | none | metering and a budget cap instead |

Runtime topology:

```
                    ┌──────────────┐
  browser ─────────▶│  web (Next)  │──── SSE ────▶ browser
                    └──────┬───────┘
                           │ SQL (RLS)
                    ┌──────▼───────┐        ┌──────────────┐
                    │  postgres    │◀──────▶│  pgvector    │
                    └──────▲───────┘        └──────────────┘
                           │
   ┌───────────┐    ┌──────┴───────┐    ┌──────────────┐
   │  redis    │◀──▶│ worker       │───▶│ S3 / MinIO   │
   └─────▲─────┘    │ (BullMQ)     │    └──────────────┘
         │          └──────┬───────┘
         │                 │ spawn / control
   ┌─────┴─────┐    ┌──────▼───────┐    ┌──────────────┐
   │ bot queue │───▶│ bot runner   │───▶│ asr worker   │
   └───────────┘    │ (Playwright) │    │ (whisper)    │
                    └──────────────┘    └──────────────┘
```

Repo layout (pnpm workspace + Turborepo):

```
apps/web            Next.js app, API route handlers, SSE
apps/worker         BullMQ workers: transcription, summaries, embeddings, skills, email, webhooks, retention
apps/bot            bot runner: provider adapters, Playwright Meet adapter, capture bridge
apps/asr            Python FastAPI + faster-whisper, HTTP/WebSocket streaming
apps/desktop        Electron client
apps/extension      MV3 extension
apps/mobile         Expo app
packages/db         Drizzle schema, migrations, repositories, RLS session helper
packages/core       domain services: meetings, notes, search, chat, billing-free metering
packages/providers  ASR/LLM/storage/email interfaces + adapters
packages/ui         design system components
infra/compose       docker-compose.yml, Caddy, MinIO, Postgres, Redis
replica/            recon, architecture, schema, design, screens
```

## Schema

Tables: **63**. Migrations live in `packages/db/migrations`; the canonical DDL is
`replica/schema.sql` (executed against PostgreSQL 16: 63 tables, 65 RLS
policies, all 63 tables RLS-enabled. The local test instance had no pgvector,
citext or pg_trgm, so those extension clauses, the `vector(1536)` column and the
HNSW/trigram indexes were substituted during the test; they are exercised in
the Docker image where the extensions are installed).

Access rules: **PostgreSQL RLS for every tenant table, plus a repository layer
that always injects `org_id`.** Every request opens a transaction and runs
`select set_config('app.org_id', $1, true)` and `set_config('app.user_id', $2, true)`.
Child tables without an `org_id` get an `exists` policy against their parent.
Auth tables (`users`, `sessions`, `auth_identities`) are self-scoped; the auth
service uses a separate `click_auth` role with `bypassrls` only for login and
session lookup. The web app never connects as the owner role.

Core decisions in the schema:

- `org_id` is denormalised onto tenant rows; RLS stays a single indexed
  predicate and every query is org-local by construction.
- `transcript_segments` is the unit of truth: every summary citation points at a
  segment, never at free text, so "jump to source" always works.
- `citations` stores `origin` (`human`/`ai`) and a label. Provenance is explicit,
  not colour-only.
- `embeddings` is polymorphic (`segment`, `note_section`, `meeting`) with an HNSW
  index, so one search path covers transcript, notes and summaries.
- `bot_jobs` has a partial unique index (`one_active_bot_per_meeting`) so a
  retry can never put two bots in the same call.
- `public_shares.token_hash` is unique and never stores the raw token.
- `consent_records` is unique per `(meeting_id, method)`; a meeting cannot move
  to `ready` without at least one row.
- `usage_meters` is the budget ledger; there is no credits table and no purchase
  path anywhere in the schema.
- `retention_policies.recording_mode = 'transcript_only'` plus `audio_days = 0`
  is the zero-audio-retention mode.
- Reporting views are `security_invoker = true`; without that a view runs as
  its owner and silently bypasses RLS for every tenant.
- Built-in templates have a null `org_id`, so they get an explicit read policy;
  the generic org policy would hide them.

## API

All app routes are under `/api/v1`; bot callbacks under `/internal/v1` and
authenticated with an HMAC over the raw body plus a per-bot token. Every route
resolves the session, then the active org, then calls a repository function that
opens a transaction with the RLS settings above. Public routes are explicitly
allow-listed and never touch tenant tables without a share token.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST `/api/v1/auth/register` | create account | public | name, email, password | session | F01 |
| POST `/api/v1/auth/login` | password login | public | email, password | session | F01 |
| POST `/api/v1/auth/magic-link` | send SMTP link | public | email | 202 | F01 |
| POST `/api/v1/auth/magic-link/consume` | exchange token | public | token | session | F01 |
| POST `/api/v1/auth/logout` | revoke session | member | — | 204 | F16 |
| GET `/api/v1/auth/oidc/[provider]` | start OIDC | public | — | redirect | F01 |
| GET `/api/v1/auth/oidc/[provider]/callback` | finish OIDC | public | code | session | F01 |
| POST `/api/v1/auth/saml/acs` | SAML assertion | public | SAMLResponse | session | F16 |
| GET `/api/v1/auth/saml/metadata` | SP metadata | public | — | XML | F16 |
| GET/PATCH `/api/v1/org` | read/update workspace | admin | name, logo, domains | org | F13 |
| GET `/api/v1/org/members` | roster | member | — | members[] | F16 |
| POST `/api/v1/org/invites` | invite teammate | admin | email, role | invite | F16 |
| POST `/api/v1/invites/[token]/accept` | join workspace | public | password? | membership | F16 |
| PATCH `/api/v1/org/members/[id]` | role/status | admin | role, status | member | F13 |
| GET/POST `/api/v1/org/groups` | list/create groups | admin | name, priority | group | F13 |
| PATCH/DELETE `/api/v1/org/groups/[id]` | edit/delete group | admin | name, members | group | F13 |
| GET/PATCH `/api/v1/org/policies` | retention, recording, privacy | admin | policy fields | policy | F13 |
| GET `/api/v1/org/audit` | audit events | admin | filters, cursor | events[] | F13 |
| GET `/api/v1/org/usage` | usage + budget | admin | period | metrics | F13 |
| GET `/api/v1/calendar/connections` | list connections | member | — | connections[] | F01 |
| POST `/api/v1/calendar/connect/[provider]` | start OAuth | member | — | redirect | F01 |
| GET `/api/v1/calendar/callback/[provider]` | store tokens | public | code | redirect | F01 |
| DELETE `/api/v1/calendar/connections/[id]` | disconnect | owner | — | 204 | F01 |
| GET `/api/v1/calendar/events` | upcoming events | member | from, to | events[] | F02 |
| PATCH `/api/v1/calendar/events/[id]` | auto-join toggle | owner | auto_join | event | F02 |
| GET/POST `/api/v1/meetings` | list/create | member | filters / upload | meetings[] | F05 |
| GET/PATCH/DELETE `/api/v1/meetings/[id]` | read/update/trash | owner or sharer | title, privacy | meeting | F06 |
| POST `/api/v1/meetings/[id]/restore` | restore from trash | owner | — | meeting | F06 |
| POST `/api/v1/meetings/[id]/consent` | record consent | capture actor | method, note | consent | F02 |
| GET `/api/v1/meetings/[id]/transcript` | transcript + segments | viewer | cursor, q | segments[] | F06 |
| PATCH `/api/v1/meetings/[id]/transcript/segments/[segmentId]` | edit text/speaker | editor | text, speaker_id | segment | F06 |
| GET `/api/v1/meetings/[id]/stream` | live transcript SSE | viewer | cursor | event stream | F02 |
| POST `/api/v1/meetings/[id]/retry` | retry processing | owner | stage | job | F17 |
| POST `/api/v1/meetings/[id]/share` | create share | owner | access, emails, role | share | F09 |
| DELETE `/api/v1/meetings/[id]/share/[shareId]` | revoke | owner | — | 204 | F09 |
| GET `/api/v1/meetings/[id]/export` | export artifacts | viewer | format | file | F06 |
| POST `/api/v1/meetings/[id]/follow-up` | draft recap email | owner | tone, recipients | draft | F11 |
| GET `/api/v1/public/recaps/[token]` | public recap | public | password? | recap | F09 |
| POST `/api/v1/meetings/[id]/bot` | send bot now | owner | provider, url | bot job | F02 |
| DELETE `/api/v1/meetings/[id]/bot` | cancel bot | owner | — | 204 | F02 |
| GET `/api/v1/bots` | fleet list | admin | state | bots[] | F02 |
| GET `/api/v1/bots/[id]` | bot detail | admin | — | bot + events | F17 |
| POST `/api/v1/bots/[id]/stop` | stop bot | admin | reason | bot | F02 |
| POST `/internal/v1/bots/[id]/lifecycle` | state callback | bot (HMAC) | state, detail | 202 | F02 |
| POST `/internal/v1/bots/[id]/segments` | stream segments | bot (HMAC) | segments[] | 202 | F02 |
| POST `/internal/v1/bots/[id]/recording` | upload artifact | bot (HMAC) | multipart | recording | F02 |
| GET/PUT `/api/v1/meetings/[id]/notes` | read/save raw notes | editor | markdown | note | F06 |
| POST `/api/v1/meetings/[id]/notes/generate` | queue enhancement | editor | template_id, length | note job | F06 |
| POST `/api/v1/meetings/[id]/notes/regenerate` | re-run with template | editor | template_id | note job | F06 |
| GET `/api/v1/notes/[id]/citations` | citations for note | viewer | — | citations[] | F06 |
| POST `/api/v1/notes/[id]/sections` | add section | editor | title, body | section | F06 |
| PATCH/DELETE `/api/v1/notes/[id]/sections/[sectionId]` | edit/remove section | editor | body, order | section | F06 |
| GET/POST `/api/v1/templates` | list/create | member | template fields | templates[] | F10 |
| GET/PATCH/DELETE `/api/v1/templates/[id]` | read/update/delete | owner | fields | template | F10 |
| GET/POST `/api/v1/recipes` | list/create | member | name, prompt, scope | recipes[] | F10 |
| GET/PATCH/DELETE `/api/v1/recipes/[id]` | read/update/delete | owner | fields | recipe | F10 |
| POST `/api/v1/recipes/[id]/run` | run on meetings | member | meeting_ids | run | F10 |
| GET/POST `/api/v1/skills` | list/create | admin | recipe, trigger | skills[] | F10 |
| PATCH/DELETE `/api/v1/skills/[id]` | edit/delete | admin | fields | skill | F10 |
| POST `/api/v1/skills/[id]/run` | run now | admin | — | run | F10 |
| GET `/api/v1/feed` | skill outputs | member | filters | items[] | F10 |
| GET/POST `/api/v1/chat/threads` | list/create thread | member | scope, ids | threads[] | F08 |
| GET/DELETE `/api/v1/chat/threads/[id]` | read/delete | owner | — | thread | F08 |
| POST `/api/v1/chat/threads/[id]/messages` | ask | owner | content, model | message | F08 |
| GET `/api/v1/chat/threads/[id]/stream` | stream answer | owner | — | SSE | F08 |
| GET/POST `/api/v1/action-items` | list/create | member | meeting_id, text | items[] | F07 |
| PATCH/DELETE `/api/v1/action-items/[id]` | update/delete | owner | status, due_at | item | F07 |
| POST `/api/v1/action-items/[id]/push` | push to integration | member | integration_key | refs | F07 |
| GET/POST `/api/v1/meetings/[id]/comments` | list/add | viewer/commenter | body, segment_id | comments[] | F06 |
| PATCH/DELETE `/api/v1/comments/[id]` | edit/resolve/delete | author | body, resolved | comment | F06 |
| POST `/api/v1/meetings/[id]/highlights` | add highlight | viewer | segment_id | highlight | F06 |
| DELETE `/api/v1/highlights/[id]` | remove | owner | — | 204 | F06 |
| POST `/api/v1/meetings/[id]/bookmarks` | add bookmark | viewer | segment_id, label | bookmark | F06 |
| DELETE `/api/v1/bookmarks/[id]` | remove | owner | — | 204 | F06 |
| GET/POST `/api/v1/meetings/[id]/soundbites` | list/create clip | viewer/editor | start_ms, end_ms | soundbites[] | F06 |
| DELETE `/api/v1/soundbites/[id]` | delete clip | owner | — | 204 | F06 |
| GET/POST `/api/v1/playlists` | list/create | member | name | playlists[] | F06 |
| PATCH/DELETE `/api/v1/playlists/[id]` | edit/delete | owner | name, items | playlist | F06 |
| GET/POST `/api/v1/folders` | list/create | member | name, parent | folders[] | F06 |
| PATCH/DELETE `/api/v1/folders/[id]` | edit/delete | owner | fields | folder | F06 |
| GET/POST `/api/v1/spaces` | list/create | admin | name, kind | spaces[] | F06 |
| PATCH/DELETE `/api/v1/spaces/[id]` | edit/delete | admin | fields | space | F06 |
| GET/POST `/api/v1/channels` | list/create | member | name, visibility | channels[] | F06 |
| PATCH/DELETE `/api/v1/channels/[id]` | edit/archive | owner | fields | channel | F06 |
| POST `/api/v1/channels/[id]/members` | add/remove members | owner | user_ids, op | members[] | F06 |
| GET `/api/v1/people` | directory | member | q | people[] | F06 |
| GET `/api/v1/people/[id]` | person + meetings | member | — | person | F06 |
| GET `/api/v1/companies` | directory | member | q | companies[] | F06 |
| GET `/api/v1/companies/[id]` | company + meetings | member | — | company | F06 |
| GET/POST `/api/v1/tags` | list/create | member | name, color | tags[] | F06 |
| GET `/api/v1/search` | keyword + filters | member | q, speaker, dates | results | F06 |
| POST `/api/v1/search/semantic` | vector search | member | q, scopes | results | F06 |
| GET `/api/v1/briefs/[meetingId]` | pre-meeting brief | member | — | brief | F11 |
| POST `/api/v1/briefs/[meetingId]/generate` | build brief | member | sources | brief | F11 |
| PATCH `/api/v1/email-drafts/[id]` | edit draft | owner | fields | draft | F11 |
| POST `/api/v1/email-drafts/[id]/send` | send via SMTP | owner | — | draft | F11 |
| GET `/api/v1/integrations` | catalogue + status | member | — | integrations[] | F14 |
| POST `/api/v1/integrations/[key]/connect` | OAuth/API key | admin | code/key | connection | F14 |
| DELETE `/api/v1/integrations/[key]` | disconnect | admin | — | 204 | F14 |
| GET/POST `/api/v1/webhooks` | list/create | admin | url, events | endpoints[] | F15 |
| PATCH/DELETE `/api/v1/webhooks/[id]` | edit/delete | admin | fields | endpoint | F15 |
| GET `/api/v1/webhooks/[id]/deliveries` | delivery log | admin | cursor | deliveries[] | F15 |
| GET/POST `/api/v1/api-keys` | list/create | admin | name, scopes | keys[] | F15 |
| DELETE `/api/v1/api-keys/[id]` | revoke | admin | — | 204 | F15 |
| GET `/api/v1/mcp` | MCP info | member | — | manifest | F15 |
| GET `/api/v1/openapi` | OpenAPI spec | public | — | JSON | F15 |
| GET/PATCH `/api/v1/settings/profile` | profile | member | name, locale, tz | profile | F16 |
| GET/PATCH `/api/v1/settings/notifications` | notification prefs | member | prefs | prefs | F16 |
| GET/POST `/api/v1/vocabulary` | list/add term | member | term, scope | terms[] | F06 |
| DELETE `/api/v1/vocabulary/[id]` | remove term | owner | — | 204 | F06 |
| GET `/api/v1/speakers` | speakers | member | q | speakers[] | F06 |
| PATCH `/api/v1/speakers/[id]` | rename/merge | member | name, merged_into | speaker | F06 |
| POST `/api/v1/speakers/merge` | bulk merge | admin | from_ids, into_id | speakers[] | F06 |
| GET/PATCH `/api/v1/admin/providers` | ASR/LLM config | admin | provider config | providers[] | F13 |
| POST `/api/v1/admin/providers/[id]/test` | connectivity test | admin | — | status | F13 |
| GET/PATCH `/api/v1/admin/smtp` | SMTP config | admin | host, user, pass | status | F13 |

That is **116 route rows** covering 74 screens. Mutating routes write an
`audit_events` row in the same transaction.

Webhooks in:

- `POST /internal/v1/bots/[id]/lifecycle` — bot state machine, HMAC + bot token.
- `POST /internal/v1/bots/[id]/segments` — batched segments, idempotent on
  `(bot_job_id, idx)`.
- `POST /internal/v1/bots/[id]/recording` — multipart or presigned PUT callback.
- `POST /api/v1/integrations/google/callback` — calendar OAuth (separate from
  login OIDC).
- `POST /api/v1/integrations/[key]/webhook` — inbound provider events (Slack
  events, CRM changes), signed per provider.

Webhooks out (signed with `X-Click-Signature: sha256=...`):

- `meeting.created`, `meeting.ready`, `meeting.failed`
- `transcript.segment` (live, batched), `transcript.ready`
- `summary.ready`, `action_item.created`, `action_item.updated`
- `skill.run.completed`, `share.created`, `share.revoked`
- `usage.budget.warning`, `usage.budget.exhausted`

Jobs (BullMQ queues):

| job | schedule | what it does |
| --- | --- | --- |
| `bot.schedule` | every 30 s | enqueue bots for calendar events starting in the next 2 minutes |
| `bot.heartbeat` | every 15 s | mark silent bots failed, alert the owner, allow one retry |
| `transcribe.meeting` | on demand | batch ASR for uploads and bot recordings |
| `transcribe.chunk` | per stream chunk | streaming ASR fallback when the live provider drops |
| `summarise.note` | on demand | map-reduce summary over long transcripts, writes sections + citations |
| `embed.objects` | on demand | embed segments, note sections and meeting summaries |
| `skill.run` | per skill trigger | run recipe on one or many meetings, write `skill_runs` + feed |
| `calendar.sync` | every 5 min | incremental sync per connection, enqueue bots |
| `email.send` | on demand | SMTP send with retries, bounce handling |
| `webhook.deliver` | on demand | signed delivery with exponential backoff, 8 attempts |
| `retention.sweep` | hourly | delete expired transcripts/audio, respect legal holds |
| `usage.rollup` | hourly | aggregate ASR seconds and tokens into `usage_meters` |
| `trash.purge` | daily | hard-delete meetings past the 30-day trash window |
| `search.reindex` | nightly | rebuild trigram/tsvector stats, re-embed changed rows |

## Joining Google Meet (the part you asked about)

There is no "one API" that lets any third-party bot join any Meet call, but
there are now three legitimate paths and one pragmatic fallback. Click ships all
of them behind one interface and picks the best available per meeting.

```
MeetingJoiner
  ├── ZoomRTMSAdapter        official  (realtime media streams)
  ├── TeamsGraphAdapter      official  (Bot Framework + Graph, P4)
  ├── MeetMediaAdapter       official  (Google Meet Media API, preferred)
  ├── MeetRestAdapter        official  (post-meeting artifacts only)
  ├── MeetBrowserAdapter     fallback  (headless Chromium via Playwright)
  └── LocalCaptureAdapter    no bot    (desktop / extension / mobile)
```

**1. Google Meet Media API (preferred, official).**
Google publishes real-time media access for Meet; the reference clients are
Apache-2.0 (`github.com/googleworkspace/meet-media-api-samples`, updated October
2026). A client authenticates as a Workspace user, joins the conference's media
session, and receives per-participant audio/video tracks plus participant
metadata over WebRTC. Click runs the Google reference client in a sidecar
container (`meet-media-sidecar`) and pipes PCM + participant events to the bot
worker. This is the cleanest path: no UI automation, no fake participant, real
speaker attribution.

Caveats to design for: it is a Workspace feature with project/edition
eligibility (expect an allowlist or admin enablement), it needs a Google Cloud
project and OAuth consent, and availability differs by Workspace edition. The UI
must show "Google Meet direct capture: available / not available for this
workspace" instead of failing at meeting time.

**2. Google Meet REST API (official, post-meeting).**
For Workspace orgs, `conferenceRecords` expose participants, recordings and
transcripts after the call. Click can import those artifacts when the meeting
was recorded by Google, with no bot at all. Useful for compliance-minded
customers and for backfilling. It is not real-time.

**3. Browser bot (fallback, opt-in).**
When the Media API is unavailable, a headless Chromium joins the Meet URL the
same way a person does: navigate, dismiss the "ask to join" dialog when admitted,
mute the mic, enable captions, and capture the meeting audio from a virtual
PulseAudio sink. This is the approach proven by Vexa (`Vexa-ai/vexa`,
Apache-2.0, ~2.9k stars) and several smaller Playwright projects. Click's
implementation is its own; Vexa is prior art and, if an operator prefers, can be
plugged in as an external bot provider over its API.

Hard rules for this adapter, because it is the risky one:

- opt-in per workspace, with a plain-language warning about provider terms and
  the possibility of breakage;
- a dedicated bot Google account, never a customer's primary account;
- one container per bot, no host mounts, egress allowlist, 2 vCPU / 2 GB, 4-hour
  cap, killed after the call;
- the bot is visible, uses the workspace's bot name, and posts the consent
  notice; it must never join anonymously;
- automatic disable after repeated join failures, with a fallback prompt to the
  desktop/extension capture path;
- a maintenance test that joins a canary meeting daily and alerts on breakage.

**4. Extension and desktop capture (no bot).**
The user records their own tab or system audio. This is the safest path, works
on every Meet plan, and is also the answer when a host refuses a bot. It is P1
for desktop and P4 for the extension.

**Zoom.** Use RTMS (Realtime Media Streams) as the primary adapter: the meeting
host authorises the app, Zoom streams audio/video to a Click endpoint over
WebSocket. Fall back to the Linux Meeting SDK bot where RTMS is not enabled.
Both are official. Marketplace listing is an approval process, not a blocker for
self-hosted credentials.

**Teams.** Bot Framework + Graph `onlineMeetings` with application-hosted media
is the official route; it needs tenant admin consent and is genuinely more work
than Zoom. Ship it in P4, and offer Graph transcript import before then.

**Webex.** Meetings API/SDK, P4. Jitsi is a `could`: the browser adapter already
works there.

Every adapter implements the same contract, so the rest of the system does not
care how the audio arrived:

```ts
type CaptureEvent =
  | { type: 'joined'; at: string; participants: Participant[] }
  | { type: 'audio'; pcm: Int16Array; startMs: number; speakerHint?: string }
  | { type: 'participants'; participants: Participant[] }
  | { type: 'left'; reason: 'ended' | 'removed' | 'error' }
  | { type: 'error'; code: string; retryable: boolean };
```

## The parts that bite

- **Time zones and DST.** Calendar events arrive with an IANA zone and an RRULE.
  Store UTC, keep the event's zone on the row, expand recurrences with a library
  (`rrule`) and never with `Date` arithmetic. "Join 2 minutes before" is computed
  from the expanded instance, not the series.
- **Idempotency.** Bot callbacks retry; calendar sync replays; webhooks arrive
  twice. `bot.segments` is idempotent on `(bot_job_id, idx)`;
  `webhook_deliveries` is unique on `(endpoint_id, event_id)`; uploads carry a
  client checksum; share creation is idempotent per `(meeting_id, access)`.
- **Races.** The partial unique index prevents two bots in one meeting. Summary
  regeneration takes a row lock on the note and bumps `version`; a late worker
  result is discarded if the version moved. Transcription writes segments in
  order with a per-transcript advisory lock.
- **Provider failure.** If cloud ASR fails mid-meeting, the bot keeps recording
  and queues batch ASR on exit; if the LLM is down, the transcript is still
  saved and the summary retries with backoff. The UI shows "transcript saved,
  summary pending", never a dead end.
- **Rate limits.** Calendar incremental sync is per-connection budgeted; ASR and
  LLM calls go through a token bucket per org; provider 429s are retried with
  jitter and surfaced as a budget warning, not a crash.
- **Long meetings and long transcripts.** Summaries use map-reduce: chunk on
  segment boundaries with overlap, summarise chunks, then reduce into sections.
  Citations survive chunking because every chunk carries segment ids.
- **Search.** Hybrid: Postgres full-text + trigram for literal recall, pgvector
  for meaning, reciprocal-rank fusion. Language config is per-meeting; a
  `simple` config avoids stemming surprises in mixed-language calls.
- **Realtime.** SSE with `Last-Event-ID` and a monotonic segment cursor. The
  client reconnects and replays from the cursor; Redis pub/sub is fan-out only,
  the database is the log.
- **Offline desktop.** The desktop client queues audio chunks locally, shows
  "will upload when online", and resumes with a checksum. It must never lose a
  recording because the laptop slept.
- **File limits.** 5 GB per upload, presigned multipart, 24-hour URL expiry,
  server-side checksum, and a hard reject of unsupported codecs before upload.
- **Email deliverability.** SMTP is the operator's; ship SPF/DKIM/DMARC guidance,
  a test-send button, bounce parsing, and a plain-text alternative. Never send
  transcripts in the body without an explicit choice.
- **Multi-tenancy.** RLS plus repository-level org injection plus per-org
  storage prefixes and short-lived signed URLs. A missing `org_id` must be a
  type error, not a runtime leak.
- **GDPR deletion.** Deleting a meeting cascades rows, enqueues object deletion,
  revokes shares, and writes an audit event. Backups have a documented 30-day
  decay; legal holds override deletion and are themselves audited.
- **Consent.** In some jurisdictions all-party consent is required. The bot posts
  a notice, the desktop shows an indicator, and a meeting without a consent
  record cannot be transcribed. Do not add a "silent mode".
- **Budget.** Token and ASR accounting happens per request, rolls up hourly, and
  a hard cap pauses AI jobs (not transcription already in flight). The error
  message tells the admin exactly which provider and which cap.
- **Bot fragility.** Meet's UI changes. The browser adapter is versioned,
  canary-tested daily, and can be disabled by an env flag without taking the
  product down.

## Build order

**Milestone 0 — foundation (1 week).** Repo, CI, compose (Postgres, Redis,
MinIO, Caddy), Drizzle migrations from `schema.sql`, design tokens, auth
(email/password + CLI reset), org + membership, empty shell.
Screens: S01, S02, S04, S07. Tables: organizations, users, memberships,
sessions, audit_events. Routes: auth, org, profile.

**Milestone 1 — vertical slice (2–3 weeks).** Upload a recording, transcribe
locally, read the transcript, generate a summary with citations, search it.
This proves ASR, storage, jobs, LLM, notes and search end to end without a bot.
Screens: S07, S08, S10, S11, S12, S13, S41, S42. Tables: meetings, recordings,
transcripts, transcript_segments, speakers, notes, note_sections, citations,
embeddings, usage_meters, provider_configs, storage_objects. Routes: meetings
CRUD, upload, transcript, notes, search, providers.

**Milestone 2 — the bot (3–4 weeks).** Zoom RTMS adapter, Meet Media adapter,
Meet browser fallback, bot queue, lifecycle, live SSE transcript, consent.
Screens: S05, S09, S24, S50, S61, S62, S63. Tables: calendar_connections,
calendar_events, bot_jobs, consent_records. Routes: calendar, bot, internal
callbacks, stream.

**Milestone 3 — workspace (3 weeks).** Folders, spaces, channels, sharing,
comments, highlights, action items, export, trash.
Screens: S15–S27, S36, S43. Tables: folders, spaces, channels, members,
comments, highlights, bookmarks, action_items, public_shares, meeting_folders,
meeting_channels, tags. Routes: collaboration and organisation.

**Milestone 4 — intelligence (3 weeks).** Ask AI with scopes and citations,
templates, recipes, scheduled skills, feed, briefs, follow-up drafts.
Screens: S28–S40. Tables: templates, recipes, skills, skill_runs, chat_threads,
chat_messages, briefs, email_drafts. Routes: chat, search, templates, skills,
briefs, email.

**Milestone 5 — reach (4 weeks).** Desktop client, extension, mobile, Teams,
Slack/Notion/CRM/PM integrations, API keys, webhooks, MCP.
Screens: S44–S46, S64–S73. Tables: integration_connections, webhook_endpoints,
webhook_deliveries, api_keys. Routes: integrations, developers, settings.

**Milestone 6 — governance (3 weeks).** OIDC/SAML/SCIM, retention, legal hold,
audit UI, analytics, conversation intelligence, accessibility pass, parity diff.
Screens: S47–S60. Tables: legal_holds, retention_policies, notifications,
groups. Routes: admin, audit.

**Milestone 7 — fixes from `/replica-entrepreneur`.** Reserved slot after the
parity diff; do not fill it with features.

## Summary

Stack: Next.js 16 + Postgres 16/pgvector + Drizzle + Auth.js + BullMQ/Redis +
S3/MinIO, self-hosted with Docker Compose, BYOK ASR/LLM, no billing.

Schema: 63 tables, 65 RLS policies, all tables RLS-enabled, DDL executed on
PostgreSQL 16 (extensions substituted in the local test).

API: 116 route rows, 3 internal bot endpoints, 11 outbound webhook events,
14 background jobs.

Three riskiest parts: (1) the Google Meet join strategy — Media API eligibility
plus a browser fallback that will break when Meet changes; (2) real-time
speaker-attributed ASR that degrades to batch without losing audio; (3)
trustworthy citations and scoped cross-meeting chat over long, multilingual
transcripts.

Next step: `/replica-design` — tokens, type scale, components and the visual
system for the 74 screens.
