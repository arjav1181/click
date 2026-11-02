# Click

[![CI](https://github.com/arjav1181/click/actions/workflows/ci.yml/badge.svg)](https://github.com/arjav1181/click/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=white)](apps/web)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](apps/web)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](packages/db)

> An open-source, self-hostable AI meeting assistant: a bot joins your calls,
> transcribes with speaker labels, writes structured notes and summaries, and
> lets you ask questions across every meeting you have ever had.

Status: **backend landed** — app shell + vertical slice (M0/M1) plus real auth,
Postgres + RLS, storage, providers, jobs and email. Architecture and operations
notes live in [`docs/development.md`](docs/development.md) and
[`docs/self-hosting.md`](docs/self-hosting.md).

Click is a clean-room rebuild of the *functionality and UX patterns* of three
public products (Fireflies.ai, Granola, Otter.ai) — the union of their features,
not any one of them. No original code, no original assets, no original copy, no
reverse engineering, no private APIs. Every line is written from public
documentation and from scratch.

> **Name note.** "Click" is a crowded software mark (ClickUp, ClickHouse, Click
> payment). It is a working name; a trademark, domain and handle sweep is a
> launch gate.

## Contents

- [Why](#why)
- [What is in scope](#what-is-in-scope)
- [Stack](#stack)
- [Running it](#running-it)
- [Layout](#layout)
- [Status](#status)
- [Contributing](#contributing)
- [Licence](#licence)


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

Scope covers 74 screens and the feature union of all three products. The
detailed scope map and parity scoreboard are kept as local working notes and
are not published in this repository.

## Stack

Next.js 16 + TypeScript · PostgreSQL 16 + pgvector · Drizzle ORM · custom
session auth (scrypt passwords, hashed session tokens, httpOnly cookie) · OIDC
via `jose` · BullMQ on Redis · S3/MinIO · Nodemailer/SMTP · Docker Compose.
The canonical 64-table schema is
[`packages/db/ddl/schema.sql`](packages/db/ddl/schema.sql).

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
| `apps/web` | Next.js app: UI, `/api/v1` routes, bot callbacks |
| `apps/bot` | Playwright meeting runner: Meet/Jitsi join, WebRTC audio capture, lifecycle callbacks |
| `apps/worker` | BullMQ worker (transcribe, summarize, embed, email) |
| `apps/asr` | local faster-whisper ASR service |
| `packages/db` | Drizzle schema, migrations, RLS-aware client, repositories |
| `packages/db/ddl/schema.sql` | canonical PostgreSQL DDL (source of the migrations and the generated schema) |
| `packages/backend` | shared server code: env, crypto, mail, storage, providers, jobs |
| `packages/ui` | shared UI components and the design tokens in `packages/ui/design` |
| `infra/compose` | Docker Compose stack |
| `docs/self-hosting.md` | deployment guide: Compose, manual install, configuration, backups |
| `docs/development.md` | code layout and the rules that keep it consistent |

## Status

| phase | state |
| --- | --- |
| Architecture | done |
| Design system | done (`packages/ui/design`) |
| Build | app shell + API-backed core flow done |
| Backend & auth | done — auth, DB + RLS, storage, providers, jobs, email |
| Bot capture | browser runner done for Meet/Jitsi (opt-in); Zoom RTMS and Teams Graph next |
| QA | pending |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR. The clean-room
rule is not negotiable: do not paste code, assets or copy from the products this
project draws inspiration from.

## Licence

AGPL-3.0. See [`LICENSE`](LICENSE).
