# Meeting Notes OSS (working title)

> An open-source, self-hostable AI meeting assistant: a bot joins your calls,
> transcribes with speaker labels, writes structured notes and summaries, and
> lets you ask questions across every meeting you have ever had.

Status: **recon in progress** (`replica/recon.md`).

This project is a clean-room rebuild of the *functionality and UX patterns* of
three public products (Fireflies.ai, Gronola, Otter.ai). No original code, no
original assets, no original copy, no reverse engineering, no private APIs.
Every line here is written from public documentation and from scratch.

## Why

Meeting notes today are SaaS-only, per-seat-priced, and hold your most
sensitive conversations in somebody else's cloud. This project is the
self-hosted alternative:

- **Your infrastructure, your data.** Docker Compose on one box, or Kubernetes
  if that is your thing.
- **Bring your own keys.** ASR and LLM providers are pluggable. Use a hosted
  provider for quality, or run Whisper locally and pay nothing.
- **Every integration, no paywall.** The bots, integrations and export formats
  that competitors gate behind a $20/seat tier are in scope here.
- **Open development.** Public roadmap, public issues, AGPL-compatible
  licensing (final licence confirmed in `replica/recon.md`).

## Layout

| path | what it is |
| --- | --- |
| `replica/recon.md` | recon map: sources, screens, flows, components, data model, scope |
| `replica/features.csv` | feature matrix (the parity scoreboard) |
| `replica/screens/` | reference screenshots of the originals (never shipped) |
| `replica/architecture.md` | stack, schema and API (written by `/replica-architect`) |
| `docs/` | user and contributor documentation |

## Status

| phase | state |
| --- | --- |
| Recon | in progress |
| Architecture | pending `/replica-architect` |
| Build | pending `/replica-build` |
| Backend & auth | pending `/replica-backend` |
| QA | pending `/replica-test` |
| Diff | pending `/replica-diff` |

## Licence

See `LICENSE`. Contributors: read `CONTRIBUTING.md`.
