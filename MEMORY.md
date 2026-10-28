# MEMORY — Click (meeting-notes OSS clone)

Single source of project knowledge for the agent. Update after every material decision.
Working directory: `/home/runner/workspace/fireflies/`. Separate git repo from the
Stonic project in the workspace root — never touch Stonic files.

## Identity
- Name: **Click** (working name; crowded trademark — ClickUp/ClickHouse/Click payment; sweep before launch).
- Tagline: open-source, self-hosted AI meeting assistant (bot capture, speaker-attributed transcripts, AI notes with citations, cross-meeting chat).
- Licence: **AGPL-3.0**. Public repo: https://github.com/arjav1181/click (main).
- Audience: OSS for SMB self-hosters. BYOK, no billing (metering + budget cap only).
- Clean-room: rebuild of functionality/UX of Fireflies.ai + Granola + Otter.ai. No original code/assets/copy/APIs.

## Products merged
Fireflies (bot + extension + desktop + mobile, auto-summary, templates, AI Skills, AskFred, channels, comments, soundbites, conversation intelligence) +
Granola (device audio, no bot, human notes + AI-enhanced notes with provenance, folders/spaces, private by default, recipes, follow-ups, no audio retention) +
Otter (bot + desktop + extension + mobile, summary + outline + insights, collaborative transcript, highlights, comments, channels, AI Chat Chat/Work + MCP, workflows, analytics).

Deliberate departures: no credits currency; no paywalls; private by default; provenance is labelled chips not colour-only; consent is a first-class record; audio retention configurable to zero.

## Scope numbers
- 74 screens (S01–S74), 17 flows (F01–F17), 51 entities, 216 features (110 must / 71 should / 23 could / 12 skip).
- Phases: P0 web, P1 bot, P2 desktop, P3 mobile, P4 extension/Teams/Webex.

## Stack
Next.js 16 + TypeScript + React 19; Postgres 16 + pgvector; Drizzle ORM; Auth.js v5 + BoxyHQ Jackson (SAML); BullMQ on Redis 7; S3/MinIO; Nodemailer/SMTP; Vercel AI SDK; SSE + Redis pub/sub; Electron desktop; MV3 extension; Expo mobile; Docker Compose.
Repo layout: pnpm workspace + Turborepo — apps/web, apps/worker, apps/bot, apps/asr, apps/desktop, apps/extension, apps/mobile; packages/db, core, providers, ui; infra/compose; replica/.

## Schema (replica/schema.sql)
- 63 tables, 65 RLS policies, all 63 tables RLS-enabled. DDL executed on PostgreSQL 16 (pgvector/citext/pg_trgm extension clauses substituted locally because extensions weren't installed).
- Tenancy: org_id denormalised; RLS per table; app sets `app.org_id`/`app.user_id` per request; child tables use exists policies; auth tables self-scoped; `click_auth` role with bypassrls for login/session.
- Views: `v_meeting_overview`, `v_org_usage` are `security_invoker = true`.
- Built-in templates (null org_id) get a dedicated read policy.
- Key invariants: bot_jobs partial unique index one_active_bot_per_meeting; public_shares.token_hash unique; consent_records unique per (meeting_id, method); usage_meters per (org_id, period_start); one default provider per (org_id, kind); embeddings HNSW; transcript_segments tsvector + trigram.
- No money/credits tables; usage_meters is the budget ledger.

## API (replica/architecture.md)
- 116 route rows under /api/v1 + 3 internal bot endpoints (/internal/v1/bots/[id]/{lifecycle,segments,recording}).
- 11 outbound webhook events, 14 BullMQ jobs.
- Mutating routes write audit_events in the same transaction.

## Google Meet joining strategy
1. Meet Media API (preferred, official) — Apache-2.0 sample clients at github.com/googleworkspace/meet-media-api-samples. Sidecar pipes PCM + participant events. Workspace edition eligibility caveats.
2. Meet REST API (official, post-meeting artifacts).
3. Browser bot fallback (opt-in) — Playwright/Chromium; prior art Vexa (Apache-2.0, ~2.9k★). Hard rules: dedicated account, visible, consent notice, opt-in, container isolation, 4h cap, daily canary, kill switch.
4. Extension/desktop capture (no bot).
Zoom: RTMS primary, Meeting SDK fallback. Teams: Bot Framework + Graph (P4). Webex P4.

## Design (replica/design) — DONE
- Tokens: `replica/design/tokens.json` (light) + `tokens.dark.json` (dark), `tokens.css`, `tailwind.theme.css`, `components.md` (47 components), `preview.html` + `preview-light.png`/`preview-dark.png`, `contrast-report.txt` (0 AA failures both themes).
- Palette placeholder: cool-neutral bg #f6f7f9, white surface, ink #111827, muted #5b6470, deep-teal accent #0f6b5f (dark #4fd1c5), danger #b42318, success #157347, warning #a85b00. Fonts: Inter (UI), Source Serif 4 (reading), JetBrains Mono. Type 12/14/16/20/28/40, 4px spacing, radius 6/10/16/24/pill.
- Design direction: union of three originals — dense 3-pane workspace (Fireflies) + document-first reading (Granola) + channel/list nav (Otter). Serif only in note reading; cool neutral surface to avoid Granola trade dress. Accent teal avoids violet/olive/blue of the three.
- Reference screenshots (public marketing/help pages) in replica/screens/ (never shipped).
- Placeholder palette: warm paper bg #faf9f6, white surface, ink #171512, muted #5f5a51, deep-teal accent #0f6b5f, danger #b42318, success #157347, warning #a85b00. Dark counterparts.
- Fonts: Inter (UI), Source Serif 4 (reading/display), JetBrains Mono (code/timestamps).
- Type scale 12/14/16/20/28/40. Spacing 4-base. Radius 6/10/16/24/pill. Layout: sidebar 248, rail 320, header 56, content 1200, reading 720.
- Design direction: union of three originals — dense 3-pane workspace (Fireflies) + document-first reading (Granola) + channel/list navigation (Otter). Warm paper + teal, serif only in notes/display. Not trade dress of any one.
- Reference screenshots captured from public marketing/help pages in replica/screens/ (never shipped).
- Contrast gate: `python3 /home/runner/workspace/.agents/skills/replica-design/contrast.py replica/design/tokens.json` must pass AA with zero failures.
- Components list: 47 components from recon (Button, Input, Select, Dialog, Drawer, Toast, Tabs, Table, Badge/chip, Avatar, Empty state, Skeleton, Transcript segment, Speaker label, Timestamp link, Citation chip, Audio player, Waveform, Recording indicator, Progress stepper, Calendar event card, Meeting card, Folder tree, Channel list, Chat message, Prompt composer, Command menu, Template card, Recipe card, Task row, Sentiment bar, Talk-time bar, Consent banner, Retention banner, Plan/limit banner, Provider card, Integration card, Key row, Audit row, Theme toggle, Language picker, Keyboard shortcut hint, Pagination, Upload dropzone, QR/pairing block).

## Build order
M0 foundation → M1 vertical slice (upload/transcribe/summary/search) → M2 bot (Zoom RTMS, Meet Media, Meet browser, SSE, consent) → M3 workspace → M4 intelligence → M5 reach (desktop/extension/mobile/Teams/integrations) → M6 governance → M7 fixes from /replica-entrepreneur.

## Git/GitHub
- Repo: https://github.com/arjav1181/click, public, main, AGPL-3.0.
- Commits: 493289a skeleton+recon, f5796f2 entity count, 9ea81f1 arch/schema/README, c4751a0 schema fixes.
- gh authenticated as arjav1181 with repo+workflow scopes; `gh auth setup-git` done.
- Credential helper configured; push works.

## Risks
1. Meet join strategy (eligibility + browser fragility).
2. Real-time speaker-attributed ASR degrading to batch.
3. Trustworthy citations + scoped cross-meeting chat over long multilingual transcripts.
4. Bot fragility (daily canary, kill switch).
5. Trademark sweep for "Click".

## Next steps
- /replica-build M0/M1 done. Next: /replica-backend (real auth, DB, storage, ASR/LLM, jobs) then continue M2+ screens.
- Record in MEMORY.md after each phase.

## Notes
- Screenshots of originals in replica/screens/ are reference only, never shipped.
- Local Postgres 16 at /nix/store.../bin; Docker daemon not running; extensions absent locally.
- User prefers decisive action; avoid long pauses.
- Do not touch /home/runner/workspace/app, components, lib, prisma, replica at workspace root (Stonic).
