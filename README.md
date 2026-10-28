# Click

> An open-source, self-hostable AI meeting assistant: a bot joins your calls,
> transcribes with speaker labels, writes structured notes and summaries, and
> lets you ask questions across every meeting you have ever had.

Status: **build in progress** — app shell + vertical slice (M0/M1) landed; see
[`replica/build-log.md`](replica/build-log.md). Architecture:
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

Next.js 16 + TypeScript · PostgreSQL 16 + pgvector · Drizzle ORM · Auth.js v5
(+ BoxyHQ Jackson for SAML) · BullMQ on Redis · S3/MinIO · Nodemailer/SMTP ·
Docker Compose. Detailed rationale and the 63-table schema are in
[`replica/architecture.md`](replica/architecture.md) and
[`replica/schema.sql`](replica/schema.sql).

## Layout

| path | what it is |
| --- | --- |
| `replica/recon.md` | recon map: sources, screens, flows, components, data model, scope |
| `replica/features.csv` | feature matrix (the parity scoreboard) |
| `replica/screens/` | reference screenshots of the originals (never shipped) |
| `replica/architecture.md` | stack, schema, API and build order |
| `replica/schema.sql` | canonical PostgreSQL DDL used by the first migration |
| `docs/` | user and contributor documentation |

## Status

| phase | state |
| --- | --- |
| Recon | done |
| Architecture | done |
| Design system | done (`/replica-design`) |
| Build | pending `/replica-build` |
| Backend & auth | pending `/replica-backend` |
| QA | pending `/replica-test` |
| Diff | pending `/replica-diff` |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR. The clean-room
rule is not negotiable: do not paste code, assets or copy from the products this
project draws inspiration from.

## Licence

AGPL-3.0. See [`LICENSE`](LICENSE).
