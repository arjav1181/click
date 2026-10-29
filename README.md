# Click

> An open-source, self-hostable AI meeting assistant: a bot joins your calls,
> transcribes with speaker labels, writes structured notes and summaries, and
> lets you ask questions across every meeting you have ever had.

Status: **backend landed** — app shell + vertical slice (M0/M1) plus real auth,
Postgres + RLS, storage, providers, jobs and email (`/replica-backend`). See
[`replica/build-log.md`](replica/build-log.md) and
[`replica/backend.md`](replica/backend.md). Architecture:
[`replica/architecture.md`](replica/architecture.md).

Click is a clean-room rebuild of the *functionality and UX patterns* of three
public products (Fireflies.ai, Granola, Otter.ai) — the union of their features,
not any one of them. No original code, no original assets, no original copy, no
reverse engineering, no private APIs. Every line is written from public
documentation and from scratch.

> **Name note.** "Click" is a crowded software mark (ClickUp, ClickHouse, Click
> payment). It is a working name; a trademark, domain and handle sweep is a
> launch gate. See `replica/architecture.md`.

## Why

Meeting notes today are SaaS-only, per-seat-priced, and hold your most
sensitive conversations in somebody else's cloud. Click is the self-hosted
alternative:

- **Your infrastructure, your data.** `docker compose up` on one box, or
  Kubernetes if that is your thing.
- **Bring your own keys.** ASR and LLM providers are pluggable. Use a hosted
  provider for quality, or run faster-whisper locally and pay nothing.
- **Every integration, no paywall.** The bots, integrations and export formats
  that competitors gate behind a per-seat tier are in scope here.
- **No billing.** Usage is metered and capped by the operator, not sold.
- **Open development.** Public roadmap, public issues, AGPL-3.0.

## What is in scope

The union of Fireflies, Granola and Otter: bot capture, calendar auto-join,
live speaker-attributed transcription, AI notes with citations, cross-meeting
search and chat, templates, recipes, scheduled skills, action items, sharing,
folders and channels, CRM/PM/Slack integrations, webhooks and an API, admin
retention and audit controls.

| surface | state |
| --- | --- |
| Web app | P0 |
| Meeting bot (Zoom, Meet, Teams) | P0–P2 |
| Desktop app (system audio) | P2 |
| Browser extension (tab audio) | P4 |
| Mobile app | P4 |

Scope, screens (S01–S74), flows (F01–F17) and the 216-row feature matrix live in
[`replica/recon.md`](replica/recon.md) and
[`replica/features.csv`](replica/features.csv).

## Stack

Next.js 16 + TypeScript · PostgreSQL 16 + pgvector · Drizzle ORM · custom
session auth (scrypt passwords, hashed session tokens, httpOnly cookie) · OIDC
via `jose` · BullMQ on Redis · S3/MinIO · Nodemailer/SMTP · Docker Compose.
Detailed rationale and the 64-table schema are in
[`replica/architecture.md`](replica/architecture.md) and
[`replica/schema.sql`](replica/schema.sql).

## Running it

```bash
cp .env.example .env          # set DATABASE_URL, APP_URL, APP_SECRET
docker compose -f infra/compose/docker-compose.yml up -d
```

That brings up Postgres (with pgvector), Redis, MinIO, the web app, the
worker, a local faster-whisper ASR service and Caddy. Without Docker:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed                 # demo login: ava@click.local / click-demo-2026
pnpm dev                     # web on :3000, jobs run inline without Redis
```

Every knob — ASR and LLM providers, storage driver, SMTP, OIDC, budget cap —
is documented in [`.env.example`](.env.example). The default providers are
deterministic mocks, so a fresh install works with no API keys and no paid
account. Full deployment guide: [`docs/self-hosting.md`](docs/self-hosting.md).

## Layout

| path | what it is |
| --- | --- |
| `replica/recon.md` | recon map: sources, screens, flows, components, data model, scope |
| `replica/features.csv` | feature matrix (the parity scoreboard) |
| `replica/screens/` | reference screenshots of the originals (never shipped) |
| `replica/architecture.md` | stack, schema, API and build order |
| `replica/schema.sql` | canonical PostgreSQL DDL used by the first migration |
| `replica/backend.md` | backend reference: data model, routes, jobs, providers, security, gaps |
| `apps/web` | Next.js app: UI, `/api/v1` routes, bot callbacks |
| `apps/worker` | BullMQ worker (transcribe, summarize, embed, email) |
| `apps/asr` | local faster-whisper ASR service |
| `packages/db` | Drizzle schema, migrations, RLS-aware client, repositories |
| `packages/backend` | shared server code: env, crypto, mail, storage, providers, jobs |
| `infra/compose` | Docker Compose stack |
| `docs/self-hosting.md` | deployment guide: Compose, manual install, configuration, backups |
| `docs/development.md` | code layout and the rules that keep it consistent |

## Status

| phase | state |
| --- | --- |
| Recon | done |
| Architecture | done |
| Design system | done (`/replica-design`) |
| Build | app shell + API-backed core flow done (`/replica-build` M0/M1) |
| Backend & auth | done (`/replica-backend`) — auth, DB + RLS, storage, providers, jobs, email |
| Bot capture (M2) | next — Zoom RTMS / Google Meet clients |
| QA | pending `/replica-test` |
| Diff | pending `/replica-diff` |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR. The clean-room
rule is not negotiable: do not paste code, assets or copy from the products this
project draws inspiration from.

## Licence

AGPL-3.0. See [`LICENSE`](LICENSE).
