# Recon map: Fireflies.ai + Granola + Otter.ai (web, bots, desktop, extension, mobile)

Scope: the union of the three products' meeting-notes functionality, rebuilt as a
self-hosted, BYOK, AGPL-3.0 open-source product for SMBs and teams who run their
own infrastructure. Capture is bot-first (server-side bot joins the call) with
botless desktop/extension/mobile capture as first-class alternatives. Billing is
out of scope (metering only). Marketing sites for the originals are out of scope;
their screens are reference only.

For: SMBs, agencies, consultancies and engineering teams who want meeting
intelligence on their own infrastructure, with their own ASR/LLM keys.

Date: 2026-10-28

> Clean-room note. This map was built only from public pages: marketing sites,
> help centres, pricing pages, public API docs, app-store listings and public
> terms. No account was used, no login was attempted, no JavaScript bundle or
> private API was read, and nothing was scraped in bulk. Screenshots of the
> originals (if added later) live in `replica/screens/` and are never shipped.
> All screen IDs, routes and flows below describe the clone, not the originals.

## Naming correction

The target named "Gronola" in the brief is **Granola** (granola.ai). `gronola.ai`
does not resolve and no product of that name exists publicly. This map treats
Granola as the third original. If a different product was meant, the Granola
rows are the ones to re-check.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Fireflies home | https://fireflies.ai/ | Positioning, capture modes, 100+ integrations, security claims |
| 2 | Fireflies pricing | https://fireflies.ai/pricing | Free/Pro/Business/Enterprise, full gating matrix |
| 3 | Fireflies notetaker | https://fireflies.ai/notetaker | Bot capture, language, accuracy claims |
| 4 | Fireflies integrations | https://fireflies.ai/integrations | Full named integration catalogue |
| 5 | Fireflies API | https://fireflies.ai/api | GraphQL, webhooks, MCP |
| 6 | Fireflies API transcripts schema | https://docs.fireflies.ai/graphql-api/query/transcripts | Data model: transcript, sentence, summary, analytics, speakers |
| 7 | Fireflies API limits | https://docs.fireflies.ai/fundamentals/limits | Upload sizes, rate limits, Add-to-Live |
| 8 | Fireflies AI credits | https://guide.fireflies.ai/articles/2114151875-learn-about-ai-credits | Metered AI operations, auto-upgrade |
| 9 | Fireflies storage & rate limits | https://guide.fireflies.ai/hc/en-us/articles/360020248558 | Per-plan storage, upload quotas |
| 10 | Fireflies summaries | https://guide.fireflies.ai/articles/9547055509 | Templates, sections, length, regenerate, admin defaults |
| 11 | Fireflies team settings | https://guide.fireflies.ai/articles/3231361498 | Admin IA: members, privacy, compliance, AI, rules, security |
| 12 | Fireflies notepad | https://guide.fireflies.ai/articles/6653885315 | Two-panel layout, sidebar tools, video rules |
| 13 | Fireflies AI Skills | https://guide.fireflies.ai/articles/6161594443 | 200+ templates, schedules, feed, permissions |
| 14 | Fireflies conversation intelligence | https://fireflies.ai/conversation-intelligence | Talk time, monologues, filler words, sentiment |
| 15 | Fireflies Live Assist | https://fireflies.ai/live-assist | Prep, live suggestions, coaching, in-call Q&A |
| 16 | Fireflies desktop app | https://fireflies.ai/desktop | Botless capture, Slack huddles, nudges, consent indicator |
| 17 | Fireflies mobile app | https://fireflies.ai/mobile | In-person capture, feed, tasks, soundbites |
| 18 | Fireflies Talk | https://fireflies.ai/talk | Dictation, 90+ languages, on-device storage |
| 19 | Fireflies Chrome extension | https://fireflies.ai/product/chrome-extension | Botless Meet capture, live transcript, in-meeting AI |
| 20 | Fireflies terms | https://fireflies.ai/terms-of-service | Reverse-engineering ban, consent obligation, credit rules |
| 21 | Fireflies privacy | https://fireflies.ai/privacy | Voice data, retention, storage countries, consent |
| 22 | Granola home | https://www.granola.ai/ | AI-notepad positioning, before/during/after loop |
| 23 | Granola pricing | https://www.granola.ai/pricing | Basic/Business/Enterprise, feature gating |
| 24 | Granola docs index | https://docs.granola.ai/llms.txt | Full help-centre inventory |
| 25 | Granola 101 | https://docs.granola.ai/help-center/getting-started/granola-101 | App anatomy: Coming up, notes, spaces, chat |
| 26 | Granola transcription | https://docs.granola.ai/help-center/taking-notes/transcription | Device-audio capture, transcript panel, speaker fallback |
| 27 | Granola AI-enhanced notes | https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes | Raw + enhanced, provenance, citations, regenerate |
| 28 | Granola templates | https://docs.granola.ai/help-center/taking-notes/customise-notes-with-templates | 29 templates, slash menu, org sharing |
| 29 | Granola chat | https://docs.granola.ai/help-center/getting-more-from-your-notes/chatting-with-your-meetings | Scopes, model choice, private history |
| 30 | Granola recipes | https://docs.granola.ai/help-center/getting-more-from-your-notes/recipes | Saved prompts, scopes, sharing, remix |
| 31 | Granola briefs | https://docs.granola.ai/help-center/taking-notes/pre-meeting-briefs | Overnight brief, sources, gating |
| 32 | Granola follow-ups | https://docs.granola.ai/help-center/taking-notes/follow-up-emails | Auto-draft, composer, expiry |
| 33 | Granola sharing | https://docs.granola.ai/help-center/sharing/sharing-notes | Link access, roles, markdown copy |
| 34 | Granola folders & spaces | https://docs.granola.ai/help-center/sharing/folders/spaces-and-folders | Spaces, folders, auto-add, permissions |
| 35 | Granola workspaces | https://docs.granola.ai/help-center/workspaces | Admin, seats, domain join |
| 36 | Granola multi-language | https://docs.granola.ai/help-center/customising-granola/multi-language | 31/32 languages, per-meeting switching |
| 37 | Granola retention | https://docs.granola.ai/help-center/consent-security-privacy/transcript-auto-deletion | Retention windows |
| 38 | Granola API | https://docs.granola.ai/introduction | REST, scopes, rate limits |
| 39 | Granola API note schema | https://docs.granola.ai/api-reference/get-note | Note/speaker/transcript/folder schema |
| 40 | Granola MCP | https://docs.granola.ai/help-center/sharing/integrations/mcp.md | MCP endpoint and tools |
| 41 | Granola transparency | https://www.granola.ai/transparency | Watermark, automated chat notice |
| 42 | Granola security | https://www.granola.ai/security | Providers, no audio storage, SOC 2 |
| 43 | Otter home | https://otter.ai/ | Conversational knowledge engine positioning |
| 44 | Otter pricing | https://otter.ai/pricing | Basic/Pro/Business/Enterprise gating |
| 45 | Otter notetaker overview | https://help.otter.ai/hc/en-us/articles/4425393298327 | Auto-join, visible participant, feature set |
| 46 | Otter conversation page | https://help.otter.ai/hc/en-us/articles/5093228433687 | Summary/Transcript tabs, takeaways, outline |
| 47 | Otter AI chat | https://help.otter.ai/hc/en-us/articles/19682180167575 | Chat vs Work modes, scopes, privacy |
| 48 | Otter integrations | https://otter.ai/integrations | Full integration list |
| 49 | Otter privacy & security | https://otter.ai/privacy-security | Consent, SOC 2, encryption, retention |
| 50 | Otter public API | https://help.otter.ai/hc/en-us/articles/36130822688279 | Conversation schema, action items, insights |
| 51 | Otter MCP | https://help.otter.ai/hc/en-us/articles/35287607569687 | Hosted MCP endpoint |
| 52 | Otter workspace analytics | https://help.otter.ai/hc/en-us/articles/15870381624087 | Usage metrics |
| 53 | Otter admin logs | https://help.otter.ai/hc/en-us/articles/42007027609879 | Audit log, CSV |
| 54 | Otter enterprise controls | https://help.otter.ai/hc/en-us/articles/13352505516695 | Recording/sharing/export governance |
| 55 | Otter live assist | https://otter.ai/live-assist | Real-time private coaching, agenda |
| 56 | Otter work mode | https://otter.ai/work-mode | Pre-brief, post follow-up, citations |
| 57 | Otter speaker management | https://help.otter.ai/hc/en-us/articles/40586357592471 | Rename/merge speakers across account |
| 58 | Otter vocabulary | https://help.otter.ai/hc/en-us/articles/360048571373 | Names, jargon, team scope |
| 59 | Otter import | https://help.otter.ai/hc/en-us/articles/360047733574 | 5 GB files, formats |
| 60 | Otter terms | https://otter.ai/terms-of-service | Consent, ownership, training, accuracy |
| 61 | Otter app store (iOS) | https://apps.apple.com/us/app/otter-transcribe-voice-notes/id1276437113 | Mobile feature inventory |
| 62 | Otter Chrome extension | https://chromewebstore.google.com/detail/bnmojkbbkkonlmlfgejehefjldooiedp | Botless Meet capture, overlay |

## Core loop

A meeting is captured (bot joins, or a local client records) -> the transcript
streams live with speaker labels -> the user's own notes plus the transcript are
turned into a structured summary with clickable citations -> action items and a
follow-up draft are produced -> everything is searchable and queryable across
the whole archive -> the results are pushed into the tools the team already
uses.

The paid loop in the originals is capture volume plus AI actions. In this clone
there is no paywall: every feature is available, and the operator sets an AI
budget so a self-hosted install cannot run away on provider costs.

## How the three originals merge

| concern | Fireflies | Granola | Otter | clone decision |
| --- | --- | --- | --- | --- |
| capture | bot + extension + desktop + mobile | device audio, no bot | bot + desktop + extension + mobile | bot-first, botless parity on every client |
| notes | auto summary, templates, AI Skills | human notes + AI-enhanced notes, provenance | summary + outline + insights | both: a raw-notes canvas that steers an enhanced note, plus auto-summary |
| transcript | two-panel notepad, soundbites, AI filters | live panel, Me/Them fallback | collaborative transcript, highlights, comments | merged transcript workspace |
| collaboration | channels, comments, bookmarks, soundbites | folders/spaces, private by default | channels, live highlights, takeaways | spaces + folders + channels, private by default |
| chat | AskFred, per meeting + global | Chat with scopes + model choice | AI Chat (Chat/Work) + MCP | one Ask AI with scopes, modes and citations |
| automation | AI Skills (scheduled), rules engine | recipes, folder auto-post, follow-ups | workflows, agent builder, work mode | Recipes (saved prompts) + Skills (scheduled jobs) + Rules |
| analytics | conversation intelligence, coaching | none (explicitly not a goal) | workspace analytics, admin logs | optional analytics module, off by default for small installs |
| governance | SSO, audit, private storage, retention | SSO/SCIM, retention, legal hold | SSO/SCIM, audit, retention, export control | all of it, self-hosted |
| pricing | per seat + AI credits | per seat tiers | per seat tiers | no billing; metering + budget cap only |

Deliberate departures from the originals, recorded so they are decisions and not
accidents:

1. **No "credits" currency.** AI usage is measured in tokens/minutes and shown
   against an operator-set budget. No purchasing, no auto-upgrade.
2. **No paywalls.** Every feature is on for every member; admins can disable
   features by policy, not by plan.
3. **Private by default.** A meeting is visible to its owner until explicitly
   shared, matching Granola, not the auto-share model of some bot tools.
4. **Provenance is not colour-only.** The originals use black/grey text (Granola)
   to separate human from AI writing. Colour-only encoding fails WCAG and is
   their trade dress, so the clone uses labelled inline citation chips
   ("you", "AI", source timestamp) plus an accessible text marker.
5. **Consent is a first-class record.** Every capture stores who consented, how,
   and when; the bot posts a visible notice and the desktop client shows an
   indicator. This is stricter than any of the three.
6. **Audio retention is configurable to zero.** Transcript-only mode discards
   audio right after ASR, matching Granola's no-audio-storage claim while still
   allowing playback for teams that want it.

## Screens

Route prefixes: `/app` = web app, `/admin` = workspace admin, `bot:` = bot
service surface, `desktop:` = desktop client, `ext:` = browser extension,
`mobile:` = mobile app, `public:` = unauthenticated page.

| ID | screen | route / how you reach it | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in | `/login` | authenticate | email+password form, magic-link tab, OIDC/SAML buttons, error banner | default, invalid, rate-limited, SSO redirect, magic link sent/expired |
| S02 | Sign up / accept invite | `/signup`, `/invite/:token` | create account or join workspace | name/email/password, invite context card, terms checkbox | open signup, invite-only, expired invite, existing account |
| S03 | CLI password reset | `./cli user reset-password` | recover without email | terminal prompts, confirm, audit line | user found, not found, weak password, done |
| S04 | Onboarding wizard | `/onboarding` | connect calendar, choose capture, pick providers, set retention | 4-step stepper, calendar OAuth, bot name, language, ASR/LLM select, consent copy | step 1-4, OAuth denied, no calendar, provider unreachable, skip |
| S05 | Calendar connections | `/settings/calendars` | connect Google/Microsoft, choose auto-join | provider cards, calendar list, auto-join rules, sync status | connected, expired token, syncing, error, no calendars |
| S06 | Workspace setup | `/admin/general` | name, logo, domain auto-join, defaults | form, domain list, toggle set, danger zone | create, edit, domain conflict, saved |
| S07 | Home | `/app` | today's meetings, quick capture, recent notes | upcoming list, record button, import, recent cards, AI budget chip | empty, upcoming, live meeting, recent, offline |
| S08 | Meetings library | `/app/meetings` | browse, filter, bulk act | search, filter bar, list/grid toggle, bulk select, sort | empty, filled, filtered empty, loading, error |
| S09 | Live meeting | `/app/meetings/:id/live` | watch capture in progress | timer, live transcript, participants, audio meter, stop, consent badge | connecting, recording, paused, bot waiting in lobby, bot denied, reconnecting, stopped |
| S10 | Meeting workspace (Notepad) | `/app/meetings/:id` | the post-meeting control centre | two-panel split, tab bar, sidebar rail, share, overflow menu | loading, ready, processing, failed, no transcript |
| S11 | AI notes tab | panel in S10 | read/regenerate enhanced notes | summary sections, citation chips, regenerate, template picker, length control | generating, ready, edited, stale, regeneration failed |
| S12 | Raw notes tab | panel in S10 | write notes that steer the AI | markdown editor, slash menu, image paste, enhance button | empty, drafting, saved, offline draft, too long |
| S13 | Transcript tab | panel in S10 | read, search, edit transcript | speaker labels, timestamps, find/replace, edit mode, undo/redo | live, final, editing, autosaving, find results, no matches |
| S14 | Player | bottom bar in S10 | listen/watch with synced text | play/pause, scrubber, speed, skip silence, captions, download | audio only, video, unavailable (retention), buffering, error |
| S15 | Outline / index | left rail in S10 | navigate the meeting | section list, chapter timestamps, action item jump, topic jump | generated, empty, stale |
| S16 | Action items | right rail / `/app/tasks` | track commitments | item rows, assignee, due date, status, push-to-tool | extracted, edited, assigned, pushed, push failed |
| S17 | Insights | right rail in S10 | keywords, topics, sentiment, questions | topic chips, sentiment bar, question list, talk-time bars | analytics off, computing, ready, sparse data |
| S18 | AI filters | transcript filter bar | one-click structured views | filter chips: questions, tasks, pricing, metrics, dates, sentiment, cleanup | idle, filtering, no matches, unsupported language |
| S19 | Soundbites | left rail / `/app/soundbites` | clip and share moments | clip list, waveform, create from selection, auto-clip toggle, playlists | empty, clipping, ready, processing, failed |
| S20 | Comments | right rail in S10 | threaded discussion on moments | comment list, composer, timestamp link, resolve | empty, thread, resolved, deleted |
| S21 | Highlights & bookmarks | right rail in S10 | personal markers | highlight list, bookmark list, filter "only highlights" | none, some, many |
| S22 | Takeaways rail | right rail in S10 | merge comments, highlights, actions | tabbed rail, counts, jump-to-moment | empty, active tab, unread |
| S23 | Share dialog | S10 -> Share | control access | link access select, invite by email, role select, copy link, revoke | private, workspace, link, pending invite, revoked |
| S24 | Meeting info | S10 -> overflow -> Info | metadata and provenance | participants, duration, source, bot log, consent record, language | complete, partial, bot failed |
| S25 | Public recap | `public:/r/:token` | share outside the org | summary, action items, player, consent notice, request access | valid, expired, revoked, password-protected |
| S26 | Channels | `/app/channels`, `/app/channels/:id` | team spaces around topics/accounts | channel list, meeting list, channel chat, members | empty, active, private, archived |
| S27 | Folders & spaces | `/app/folders`, `/app/folders/:id` | organise notes | tree, drag-drop, folder header, auto-add rule, permissions | personal, team, shared, empty, nested |
| S28 | People | `/app/people` | directory built from meetings | person cards, meeting history, per-person chat | empty, enriched, no data |
| S29 | Companies | `/app/companies` | company directory | company cards, people, meetings, chat | empty, enriched, no data |
| S30 | Templates | `/app/templates` | note/summary structures | template list, editor, section builder, preview, org share | built-in, custom, editing, preview, shared |
| S31 | Recipes | `/app/recipes` | saved prompts across meetings | discover/my/workspace tabs, cards, search, run | empty, filled, running, error |
| S32 | Recipe builder | `/app/recipes/:id/edit` | create/edit a recipe | prompt editor, scope radio, model select, sharing | create, edit, validation, saved |
| S33 | Skills | `/app/skills` | scheduled automations | skill list, enable toggle, schedule, last run, output target | active, paused, running, failed, never run |
| S34 | Skill builder | `/app/skills/:id/edit` | define trigger, prompt, output | trigger picker, prompt, model, integrations, test run | draft, testing, valid, error |
| S35 | Feed | `/app/feed` | outputs from skills and automation | feed cards, filters by skill/date/creator, open result | empty, new items, filtered |
| S36 | Tasks | `/app/tasks` | all action items across meetings | filters, grouping, bulk update, export | empty, open, done, overdue |
| S37 | Ask AI | `/app/ask` | chat across meetings | scope picker (all/folder/channel/person/selection), composer, citations, model select, history | empty, streaming, answered, no sources, budget exceeded |
| S38 | In-meeting AI | side panel in S09 | ask during the call | suggested questions, answer cards, send-to-meeting-chat | idle, thinking, answered, unavailable |
| S39 | Pre-meeting brief | `/app/briefs/:eventId` | prep before a meeting | bullets, sources, linked past meetings, feedback | ready, generating, no context, disabled |
| S40 | Follow-up composer | `/app/meetings/:id/follow-up` | draft and send recap email | recipients, subject, body, attachments, signature, send/undo | draft, edited, sending, sent, failed, expired |
| S41 | Search | `/app/search` | find anything | query, filters (speaker, date, folder, channel, language), results, semantic toggle | idle, results, no results, loading, error |
| S42 | Import | `/app/import` | upload audio/video | dropzone, file list, language, progress, cancel | empty, uploading, transcribing, done, failed, too large |
| S43 | Export | S10 -> Download / `/app/export` | get data out | format picker (md, txt, pdf, docx, srt, vtt, json, mp3), bulk select | single, bulk, preparing, ready, failed |
| S44 | Integration hub | `/app/integrations` | connect third-party tools | category tabs, search, cards, connect modal, status | connected, disconnected, error, needs reauth |
| S45 | API keys & webhooks | `/app/developers` | programmatic access | key list, create/revoke, scopes, webhook endpoints, delivery log | none, active, revoked, failing |
| S46 | MCP setup | `/app/developers/mcp` | connect AI clients | endpoint, token, client snippets, tool list | enabled, disabled by admin |
| S47 | Personal settings | `/settings` | profile, language, notifications, vocabulary, speakers | sections, forms, save bar | default, editing, saved, error |
| S48 | Speaker management | `/settings/speakers` | merge/rename speakers | speaker list, merge dialog, rename, apply-to-all | unnamed, named, merged, conflict |
| S49 | Vocabulary | `/settings/vocabulary` | improve accuracy | term list, scope (personal/workspace), bulk add | empty, filled, over limit |
| S50 | Consent & transparency | `/settings/privacy` | recording notice, watermark, chat message | toggles, message editor, platform matrix | on, off, admin-locked |
| S51 | Retention | `/settings/retention` | auto-delete and transcript-only mode | retention select, audio policy, legal hold notice | default, custom, locked, applying |
| S52 | Notifications | `/settings/notifications` | email and in-app preferences | digest, mentions, follow-ups, meeting reminders | on, off, quiet hours |
| S53 | Admin: members | `/admin/members` | invite, roles, deactivate | table, role select, bulk actions, invite dialog, groups | active, invited, deactivated, last admin guard |
| S54 | Admin: groups | `/admin/groups` | teams for sharing and templates | group list, member picker, template assignment | empty, filled, overlap warning |
| S55 | Admin: recording & privacy | `/admin/recording` | workspace capture policy | auto-join defaults, bot name, consent notice, private-by-default | on, off, per-team override |
| S56 | Admin: AI policy | `/admin/ai` | providers, models, budget, feature gates | provider cards, model defaults, budget cap, per-feature toggles | configured, missing key, budget hit, disabled |
| S57 | Admin: analytics | `/admin/analytics` | adoption and usage | charts, filters, per-member table, export | empty, populated, date range empty |
| S58 | Admin: audit log | `/admin/audit` | who did what | event table, filters, CSV export, detail drawer | empty, populated, export running |
| S59 | Admin: legal hold | `/admin/legal-hold` | preserve data for matters | hold list, custodians, release, scope | active, released, none |
| S60 | Admin: instance ops | `/admin/instance` | SMTP, storage, SSO, backups | SMTP form, S3/MinIO config, OIDC/SAML, test buttons | configured, test failed, degraded |
| S61 | Bot console | `bot:/console` | operate the bot fleet | join queue, active bots, lobby waits, errors, logs | idle, joining, in-call, failed, retrying |
| S62 | Bot join settings | S10 -> "Send bot" / S07 | choose when a bot joins | meeting picker, display name, consent message, join now | scheduled, joining, joined, declined |
| S63 | Bot chat notice | external meeting chat | tell participants they are recorded | message template, link to recap | posted, blocked, edit |
| S64 | Desktop: capture overlay | `desktop:` floating pill | record system + mic without a bot | timer, waveform, pause, stop, consent indicator, snapshot toggle | idle, recording, paused, permission missing, call ended |
| S65 | Desktop: pre-meeting | `desktop:` notification + panel | prep before joining | upcoming, brief, open notes | ready, no calendar, offline |
| S66 | Desktop: live notes | `desktop:` note window | write during the call | markdown editor, transcript panel, slash templates | empty, typing, synced, offline |
| S67 | Desktop: settings | `desktop:` preferences | devices, permissions, shortcuts, language | pickers, permission rows, shortcut list | granted, denied, unsupported OS |
| S68 | Extension: popup | `ext:` toolbar | choose capture mode | record-here vs send-bot, language, start | idle, recording, unsupported page, permission denied |
| S69 | Extension: overlay | `ext:` in-page | live captions over the tab | floating transcript, minimize, stop | listening, live, paused, error |
| S70 | Mobile: home | `mobile:` tab 1 | upcoming and recent | upcoming cards, record FAB, recent list, search | empty, filled, offline |
| S71 | Mobile: record | `mobile:` FAB | in-person capture | timer, live transcript, speaker add, pause/stop | recording, paused, permission denied, interrupted by call |
| S72 | Mobile: meeting | `mobile:` tab 2 | read notes and transcript on the go | summary, transcript, actions, share, player | loading, ready, audio unavailable |
| S73 | Mobile: ask & tasks | `mobile:` tabs 3-4 | query and act | chat, task list, notifications | empty, answered, offline |
| S74 | Error / degraded state | any surface | explain failures | reason, retry, link to logs, support contact | offline, provider down, quota, permission, migration needed |

That is 74 screens. The count is honest for the union; the phased plan below
reduces the first shippable slice to 12 of them.

## Flows

```
F01 First run to first captured meeting
    S02 -> S04 -> S05 -> S07 -> S09
    happy path clicks: 9 (plus OAuth)
    edge: invite expired, calendar OAuth denied, no calendar provider,
          bot name taken, workspace domain conflict, SMTP not configured

F02 Bot joins a scheduled meeting
    S05 auto-join -> S61 queue -> lobby -> S09 live -> S10
    happy path clicks: 0 after setup
    edge: host admits manually, bot denied, meeting starts late, meeting
          rescheduled, recurring series, bot removed mid-call, recording
          consent declined, meeting longer than plan limit (no limit here)

F03 Botless capture on desktop
    S64 -> S66 -> S10
    happy path clicks: 2
    edge: screen-recording permission missing, system audio unsupported,
          headphones vs speakers, two meetings at once, app crash mid-call
          (recover partial transcript)

F04 Capture from the browser extension
    S68 -> S69 -> S10
    happy path clicks: 2
    edge: Meet tab in background, tab muted, multiple tabs, browser restart,
          extension lacks host permission

F05 Upload a recording
    S42 -> processing -> S10
    happy path clicks: 4
    edge: 5 GB limit, unsupported codec, stereo vs mono, corrupt file,
          duplicate upload, language mismatch, very long file

F06 Understand a meeting after the fact
    S10 -> S11 -> citation -> S14 at timestamp -> S16
    happy path clicks: 3
    edge: no transcript, summary failed, speaker names wrong, transcript-only
          mode (no audio to play), edited summary becomes stale

F07 Capture and act on an action item
    S11 -> S16 -> assign -> push to Jira/Linear/Asana
    happy path clicks: 4
    edge: integration not connected, assignee not a member, push fails,
          item deleted at source, duplicate pushes

F08 Ask across the archive
    S37 -> scope picker -> question -> citation -> S10
    happy path clicks: 3
    edge: zero meetings, folder scope empty, budget exceeded, model timeout,
          conflicting answers, non-English corpus

F09 Share a meeting
    S10 -> S23 -> link role -> copy -> S25
    happy path clicks: 3
    edge: private by default, domain restriction, revoked link, expired link,
          external viewer requests access, admin locks public links

F10 Run a saved recipe / scheduled skill
    S31/S33 -> run -> S35
    happy path clicks: 2 (manual) / 0 (scheduled)
    edge: skill disabled by admin, model budget hit, no new meetings,
          output destination disconnected, run partially failed

F11 Prep and follow up around a meeting
    S39 brief -> meeting -> S11 notes -> S40 follow-up -> send
    happy path clicks: 5
    edge: no past context, Gmail/SMTP not connected, external attendees only,
          draft expires, send fails, user edits then sends

F12 Dictate into another app
    S47 hotkey -> overlay -> text inserted
    happy path clicks: 0 with hotkey
    edge: no microphone permission, unsupported app, very long dictation,
          language switch, offline (local Whisper fallback)

F13 Admin sets policy
    S55 -> S56 -> S51 -> S58
    happy path clicks: 6
    edge: last admin cannot be demoted, policy conflicts with legal hold,
          retention shorter than legal hold, budget zero disables AI

F14 Connect an integration and route outputs
    S44 -> OAuth -> choose destination -> test -> S35
    happy path clicks: 5
    edge: OAuth denied, token revoked, destination deleted, rate limited,
          duplicate records, permission scope missing

F15 Use the API or MCP
    S45 -> create key -> call API -> webhook delivered
    happy path clicks: 3
    edge: key revoked, scope missing, rate limited, webhook signature fail,
          replay, pagination

F16 Invite and onboard a teammate
    S53 -> invite -> S02 -> S04 -> first meeting
    happy path clicks: 6
    edge: invite expired, email already a member, SSO required, domain
          auto-join, seat limit (none), deactivated user returns

F17 Recover from a failed capture
    S74 -> S61 logs -> retry join -> S09
    happy path clicks: 2
    edge: provider outage, bot image crash, audio silent, ASR provider down,
          local Whisper fallback used
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, active, disabled, loading | all |
| Input / textarea | text, email, password, search, markdown | default, focus, invalid, disabled, read-only | all |
| Select / combobox | single, multi, searchable | closed, open, filtering, empty, disabled | settings, filters |
| Dialog | info, confirm, destructive, form | open, submitting, error, success | all |
| Drawer / side panel | left, right, bottom | open, resizing, collapsed | S10, S22 |
| Toast | info, success, warning, error | auto-dismiss, action, sticky | all |
| Tabs | underline, pill, segmented | default, active, disabled, overflow | S10, S11, S22 |
| Table | simple, sortable, selectable, virtualised | empty, loading, filled, error | S08, S36, S53, S58 |
| Badge / chip | status, tag, filter, citation | neutral, success, warning, danger, removable | all |
| Avatar | user, bot, company | image, initials, fallback, group | S24, S28, S53 |
| Empty state | page, panel, search, filtered | illustration, title, action, secondary link | all |
| Skeleton | line, card, table, transcript | loading, reduced motion | all |
| Transcript segment | speaker, paragraph, search-hit, edited | live, final, highlighted, editing, selected | S09, S13, S14 |
| Speaker label | named, unnamed, "me"/"them", merged | default, editable, conflict | S13, S48 |
| Timestamp link | inline, block | default, hover, active | S11, S13, S15 |
| Citation chip | "you", "AI", transcript, document | default, hover preview, broken | S11, S37 |
| Audio player | compact, full, video | idle, playing, buffering, unavailable, error | S14, S25 |
| Waveform | live input, playback, clip | idle, live, muted, unavailable | S19, S64, S71 |
| Recording indicator | bot, desktop, mobile, extension | recording, paused, consent-pending | all capture surfaces |
| Progress stepper | onboarding, upload, bot join | pending, active, done, error | S04, S42, S61 |
| Calendar event card | upcoming, live, past | default, joinable, recording, cancelled | S07, S65 |
| Meeting card | list, grid, compact | default, hover, selected, processing, failed | S07, S08 |
| Folder tree | spaces, folders, nested | expanded, collapsed, drag-over, locked | S27 |
| Channel list | public, private, archived | default, unread, muted | S26 |
| Chat message | user, assistant, system, tool | streaming, sent, stopped, error, cited | S37, S38, S73 |
| Prompt composer | text, with attachments, voice | empty, focused, sending, disabled, over budget | S37, S38 |
| Command menu | slash commands, templates, actions | closed, open, filtered, no results | S12, S37 |
| Template card | built-in, custom, shared | default, selected, preview | S30 |
| Recipe card | discover, mine, workspace | default, running, shared, remixable | S31 |
| Task row | inline, table, board | open, done, overdue, pushed, failed | S16, S36 |
| Sentiment bar | meeting, speaker | neutral, mixed, positive, negative, no data | S17, S57 |
| Talk-time bar | per speaker | default, hover, no data | S17 |
| Consent banner | bot, desktop, mobile, extension | required, acknowledged, declined | capture surfaces |
| Retention banner | info, warning, locked | default, applying, legal hold | S51, S59 |
| Plan/limit banner | n/a (no plans) | budget warning, budget exhausted | S37, S56 |
| Provider card | ASR, LLM, storage, email | unconfigured, testing, ok, error | S56, S60 |
| Integration card | connected, available, unavailable | default, connecting, connected, error, reauth | S44 |
| Key row | API key, webhook | active, revoked, failing | S45 |
| Audit row | event | default, expanded | S58 |
| Theme toggle | light, dark, system | selected | all |
| Language picker | transcription, summary, UI | default, auto-detect, unsupported | S04, S47 |
| Keyboard shortcut hint | inline, modal | default | S47, S64 |
| Pagination | cursor, page numbers | default, first, last, loading | S08, S58 |
| Upload dropzone | audio, video, bulk | idle, drag-over, uploading, error | S42 |
| QR / pairing block | desktop, mobile | waiting, paired, expired | S64 |

## Inferred data model

The originals expose enough public schema (Fireflies GraphQL, Granola REST,
Otter API) to infer most of this. Fields marked `guess` are design choices, not
observed.

```
Organization      id, name, slug, logo_url, domain_allowlist[], settings_json,
                  created_at
                  evidence: Granola workspaces, Otter workspace admin, Fireflies team
                  confidence: high

User              id, org_id, email, name, password_hash, avatar_url, locale,
                  timezone, role, status, last_seen_at, created_at
                  evidence: all three; SSO/SCIM docs
                  confidence: high

Membership        id, org_id, user_id, role (owner|admin|member), group_ids[],
                  status (active|invited|deactivated)
                  evidence: Otter roles, Fireflies super admin, Granola admin/member
                  confidence: high

Group             id, org_id, name, member_ids[], template_id, priority
                  evidence: Fireflies User Groups, Granola User Groups
                  confidence: high

AuthIdentity      id, user_id, provider (password|google|microsoft|oidc|saml),
                  subject, metadata_json, last_login_at
                  evidence: all three SSO docs
                  confidence: high

Session           id, user_id, token_hash, user_agent, ip, expires_at
                  evidence: standard; not exposed publicly
                  confidence: guess

ApiKey            id, org_id, user_id, name, prefix, hash, scopes[], last_used_at,
                  revoked_at
                  evidence: Granola API keys grn_, Fireflies API key page
                  confidence: high

CalendarConnection id, user_id, provider (google|microsoft), account_email,
                  refresh_token_enc, sync_token, status
                  evidence: all three calendar sync
                  confidence: high

CalendarEvent     id, connection_id, external_id, title, description,
                  starts_at, ends_at, organizer_email, attendees_json,
                  meeting_url, provider, auto_join, bot_status
                  evidence: all three; Granola CalendarEvent schema
                  confidence: high

Meeting           id, org_id, owner_id, calendar_event_id, title, started_at,
                  ended_at, duration_s, language, source
                  (bot|desktop|extension|mobile|web|upload|api),
                  status (scheduled|joining|live|processing|ready|failed),
                  privacy (private|workspace|link), folder_ids[], channel_ids[],
                  consent_state, retention_state, created_at
                  evidence: Fireflies Transcript, Otter Conversation, Granola Note
                  confidence: high

MeetingParticipant id, meeting_id, user_id (nullable), display_name, email,
                  speaker_id, joined_at, left_at, is_organizer
                  evidence: Fireflies meeting_attendees/attendance, Otter calendar_guests
                  confidence: high

BotJob            id, meeting_id, provider (zoom|teams|meet|webex),
                  scheduled_at, state, attempts, lobby_reason, error_code,
                  join_url, recording_ref
                  evidence: Fireflies notetaker, Otter notetaker, bot docs
                  confidence: high

Recording         id, meeting_id, storage_key, kind (audio|video|screen),
                  codec, duration_s, size_bytes, checksum, deleted_at
                  evidence: all three; Granola explicitly stores none
                  confidence: high

Transcript        id, meeting_id, language, provider, model, status,
                  word_count, confidence_avg, created_at
                  evidence: Fireflies transcripts, Granola transcript, Otter transcript
                  confidence: high

TranscriptSegment id, transcript_id, index, speaker_id, start_ms, end_ms,
                  text, raw_text, edited, confidence, sentiment,
                  flags_json (question|task|pricing|metric|date)
                  evidence: Fireflies sentence + ai_filters, Otter segments
                  confidence: high

Speaker           id, org_id, name, email, is_me, voice_profile_ref,
                  merged_into_id, created_at
                  evidence: Fireflies speakers, Otter speaker management, Granola attribution
                  confidence: high

VocabularyTerm    id, org_id, user_id (nullable), term, kind (name|jargon),
                  created_at
                  evidence: Otter custom vocabulary, Granola jargon
                  confidence: high

Note              id, meeting_id, author_id, raw_markdown, enhanced_markdown,
                  enhanced_status, template_id, model, generated_at, edited_at,
                  version
                  evidence: Granola raw/enhanced, Fireflies summary, Otter summary
                  confidence: high

NoteSection       id, note_id, key, title, body_markdown, order_index,
                  source (template|ai|custom)
                  evidence: Fireflies summary sections, Otter insights/outline
                  confidence: high

Citation          id, note_id, section_id, segment_id, quote, start_ms,
                  origin (human|ai), label
                  evidence: Granola Zoom-In, Otter clickable citations
                  confidence: medium

Template          id, org_id, owner_id, name, description, sections_json,
                  prompt, scope (personal|group|workspace), is_builtin
                  evidence: Fireflies templates, Granola templates, Otter templates
                  confidence: high

Recipe            id, org_id, owner_id, name, prompt, scope
                  (single|multi), model, visibility, version
                  evidence: Granola recipes, Fireflies AI Skills
                  confidence: high

Skill             id, org_id, recipe_id, trigger (manual|per_meeting|daily|
                  weekly|monthly), target_filter_json, output_targets_json,
                  enabled, last_run_at, created_by
                  evidence: Fireflies AI Skills schedules + feed
                  confidence: high

SkillRun          id, skill_id, meeting_ids[], status, output_markdown,
                  error, tokens_in, tokens_out, started_at, finished_at
                  evidence: Fireflies Feed, Granola recipe runs
                  confidence: medium

ChatThread        id, org_id, user_id, scope (global|folder|channel|meeting|
                  person|company|selection), scope_ids[], mode (chat|work),
                  title, created_at
                  evidence: Granola Chat, Otter AI Chat, Fireflies AskFred
                  confidence: high

ChatMessage       id, thread_id, role (user|assistant|tool), content,
                  model, tokens, citations_json, created_at
                  evidence: same
                  confidence: high

ActionItem        id, meeting_id, owner_user_id, assignee_name, text, status,
                  due_at, source_segment_id, pushed_refs_json, created_at
                  evidence: Fireflies action_items, Otter action items, Granola actions
                  confidence: high

Comment           id, meeting_id, user_id, segment_id, parent_id, body,
                  resolved_at, created_at
                  evidence: Fireflies comments, Otter comments
                  confidence: high

Highlight         id, meeting_id, user_id, segment_id, color, created_at
                  evidence: Otter highlights, Fireflies bookmarks
                  confidence: high

Bookmark          id, meeting_id, user_id, segment_id, label
                  evidence: Fireflies bookmarks
                  confidence: medium

Soundbite         id, meeting_id, created_by, start_ms, end_ms, title,
                  storage_key, auto_generated, created_at
                  evidence: Fireflies soundbites + magic soundbites
                  confidence: high

Playlist          id, org_id, owner_id, name, soundbite_ids[], visibility
                  evidence: Fireflies playlists
                  confidence: high

Folder            id, org_id, space_id, parent_id, name, icon, description,
                  owner_id, members_json, link_access
                  evidence: Granola folders/spaces, Otter folders
                  confidence: high

Space             id, org_id, name, icon, description, member_ids[],
                  kind (personal|team|custom)
                  evidence: Granola spaces, Otter channels
                  confidence: high

Channel           id, org_id, name, visibility (public|private), member_ids[],
                  description, archived_at
                  evidence: Otter channels, Fireflies channels
                  confidence: high

Person            id, org_id, name, email, title, company_id, avatar_url,
                  meeting_ids[], enrichment_json
                  evidence: Fireflies contacts, Granola people
                  confidence: medium

Company           id, org_id, name, domain, logo_url, meeting_ids[],
                  enrichment_json
                  evidence: Granola companies
                  confidence: medium

Integration       key, name, category, auth_kind, scopes, docs_url
                  evidence: Fireflies/Otter/Granola integration catalogues
                  confidence: high

IntegrationConnection id, org_id, user_id, integration_key, credentials_enc,
                  config_json, status, connected_at
                  evidence: all three
                  confidence: high

WebhookEndpoint   id, org_id, url, secret_hash, events[], active, last_status
                  evidence: Fireflies webhooks, Granola webhooks
                  confidence: high

EmailDraft        id, meeting_id, user_id, to[], cc[], bcc[], subject, body,
                  attachments_json, status, expires_at, sent_at
                  evidence: Granola follow-ups, Otter work mode
                  confidence: medium

Brief             id, meeting_id, user_id, bullets_json, sources_json,
                  feedback, generated_at
                  evidence: Granola briefs, Otter work mode
                  confidence: medium

RetentionPolicy   id, org_id, transcript_days, audio_days, recording_mode,
                  legal_hold_override, updated_by
                  evidence: all three retention docs
                  confidence: high

ConsentRecord     id, meeting_id, method (bot_notice|chat_message|watermark|
                  desktop_indicator|explicit), acknowledged_by, at
                  evidence: Fireflies/Otter/Granola consent docs
                  confidence: medium

AuditEvent        id, org_id, actor_id, action, target_type, target_id,
                  metadata_json, ip, created_at
                  evidence: Otter admin logs, Fireflies audit, Granola audit API
                  confidence: high

UsageMeter        id, org_id, period_start, period_end, asr_seconds,
                  llm_tokens_in, llm_tokens_out, cost_estimate, budget_cap
                  evidence: Fireflies AI credits, Granola usage analytics
                  confidence: high

ProviderConfig    id, org_id, kind (asr|llm|embedding|email|storage),
                  provider, base_url, api_key_enc, model, options_json,
                  is_default, status
                  evidence: BYOK requirement; originals expose model choice
                  confidence: high

StorageObject     key, org_id, meeting_id, kind, size_bytes, content_type,
                  encryption, created_at
                  evidence: self-hosted S3/MinIO design
                  confidence: guess

PublicShare       id, meeting_id, token_hash, access (link|domain|password),
                  password_hash, expires_at, revoked_at, created_by
                  evidence: all three sharing models
                  confidence: high

Notification      id, user_id, kind, payload_json, read_at, created_at
                  evidence: all three notification surfaces
                  confidence: medium
```

Relationships: Organization 1-n User, Group, Meeting, Template, Recipe, Skill,
IntegrationConnection, ApiKey, AuditEvent, RetentionPolicy. Meeting 1-n
Participant, Transcript, ActionItem, Comment, Highlight, Bookmark, Soundbite,
Note, Recording. Transcript 1-n Segment; Segment n-1 Speaker. Note 1-n
NoteSection 1-n Citation. Skill 1-n SkillRun. Folder 1-n Folder; Space 1-n
Folder; Meeting n-n Folder and n-n Channel. ChatThread 1-n ChatMessage. User 1-n
CalendarConnection 1-n CalendarEvent 1-n Meeting. Meeting 1-1 PublicShare
(optional) and 1-n ConsentRecord.

## Feature matrix

See `features.csv`. The union is large: 216 rows, of which 110 must, 71 should,
23 could and 12 skip. Every `clone` cell starts at `no` (or `skip` for the
deliberate noes); the build fills them in and `/replica-diff` scores against the
priorities.

## Out of scope (cannot or should not be cloned)

- **The three brands and their assets.** Names, logos, wordmarks, mascots,
  illustration styles, marketing copy, template texts, recipe titles ("Coach
  me", "Write PRD"), plan names and customer logo walls. All of it is their IP.
- **The black/grey "human vs AI" colour convention.** It is Granola's trade
  dress and fails accessibility; the clone uses labelled citation chips instead.
- **Purchasable AI credits, seat plans, trials and discount programmes.** There
  is no billing in this project; an operator-set budget replaces credits.
- **Their model routing, provider contracts and prompt libraries.** We ship our
  own prompts and let operators bring keys.
- **Source code, bundles, private APIs, network traces.** Not read, not copied;
  Fireflies' terms forbid reverse engineering.
- **The original user bases, communities, customer references and review
  scores.** Not transferable.
- **Google Meet bot joining.** Google has no public API for a third-party bot to
  join Meet as a participant. Meet capture is done through the browser
  extension or the desktop client, and the UI says so plainly.
- **Native Zoom/Teams marketplace listing approval.** The clone can join via the
  providers' meeting SDKs/bot frameworks, but publishing in their marketplaces
  is an approval process, not a feature. Ship self-hosted credentials first.
- **Voice cloning and outbound AI phone agents.** Fireflies' Voice Agents are a
  telephony product with robocall/consent law attached (TCPA and equivalents).
  It is a `could` row for a later phase with an explicit compliance gate, not
  part of the core parity target.
- **Biometric voiceprints for cross-meeting speaker identification.** Speaker
  diarization within a meeting is in scope; persistent voiceprints are treated
  as sensitive biometric data and left out by default.
- **Native mobile/desktop store distribution.** The clients are ours and are
  built, but App Store/Play/notarised distribution requires paid accounts and
  review; self-hosted builds and sideloading come first.
- **Their data.** No meeting content, transcripts, recordings, customer lists or
  analytics are taken from any original.

## Capture reality check

The single riskiest assumption in this plan is "the bot joins any call". What is
actually possible with public provider APIs:

| provider | bot join | how | caveat |
| --- | --- | --- | --- |
| Zoom | yes | Meeting SDK / RTMS with a Zoom app + credentials | app review for marketplace distribution; self-hosted credentials work |
| Microsoft Teams | yes | Bot Framework + Graph onlineMeetings | tenant admin consent required; some plans restrict |
| Google Meet | no public bot API | browser extension or desktop client captures tab/system audio | must be stated in UI; no silent participant |
| Webex | partial | Webex meetings API / SDK depending on plan | requires org credentials |
| In-person | n/a | desktop/mobile/web recorder | consent indicator required |
| Uploads | n/a | file import | 5 GB per file, common codecs |

Consequence: the product promises "bot joins where the provider allows it, and
botless capture everywhere else", with a capability table in the UI. That is
honest and it still matches the user-facing loop of all three originals.

## Platform constraints (self-hosted BYOK)

1. **ASR is pluggable.** Default local faster-whisper (GPU optional, CPU works
   for small models). Also Deepgram, AssemblyAI, Groq, OpenAI, and any
   OpenAI-compatible endpoint. Streaming ASR is required for live transcripts;
   batch ASR is enough for uploads.
2. **LLM is pluggable.** OpenAI, Anthropic, Ollama, vLLM, OpenRouter, any
   OpenAI-compatible base URL. Embeddings for semantic search are pluggable too
   (default local sentence-transformers or pgvector + provider embeddings).
3. **Storage is S3-compatible.** MinIO in compose; any S3 bucket in production.
   Local disk fallback for single-box installs.
4. **Postgres + pgvector** for relational data and semantic search. No external
   search cluster in P0; Typesense/OpenSearch is a `could`.
5. **Queue and workers.** Redis + BullMQ for bot jobs, transcription, summary,
   skill runs, webhooks. One compose file, separate worker containers.
6. **Auth.** Email+password, CLI reset, optional SMTP magic link, OIDC and SAML
   for enterprise. SCIM is a `should`.
7. **No billing code.** Metering tables and a budget cap only.
8. **Deployment target.** `docker compose up` on a 4 vCPU / 8 GB box handles a
   small team with local Whisper (CPU, small model). GPU box recommended for
   real-time local ASR at team scale.
9. **Consent and retention are enforced in code**, not just documented: a
   meeting cannot be captured without a consent record, and retention jobs run
   on a schedule with an audit trail.
10. **Provider failure must degrade, not break.** If the cloud ASR is down, fall
    back to local Whisper; if the LLM is down, the transcript is still saved and
    the summary is queued with a retry.

## Size

Screens 74, flows 17, entities 43. Hard parts: real-time streaming ASR with
speaker diarization; meeting-bot lifecycle across three providers with lobby and
consent handling; durable job orchestration for long recordings; LLM summaries
with trustworthy citations back to transcript segments; cross-meeting semantic
search and chat with scoping; multi-tenant governance (roles, retention, legal
hold, audit); offline-capable desktop capture; and the integration surface
(OAuth, webhooks, retries, idempotency).

Size: **XL**. Full union parity is a multi-month build, and pretending otherwise
would be dishonest. Recommended phasing:

- **P0 — vertical slice (S)**: auth + org + calendar, upload and desktop capture,
  local Whisper transcription, transcript view, AI summary with citations, one
  meeting workspace, search. No bot, no integrations, no admin beyond members.
- **P1 — the bot (M)**: Zoom bot, bot job queue, live transcript, consent
  notice, meeting chat posting, retry/failure console.
- **P2 — the workspace (M)**: folders/spaces/channels, sharing and public recap,
  comments/highlights/bookmarks, action items and tasks, templates, export.
- **P3 — the intelligence layer (M)**: Ask AI with scopes and citations,
  recipes, scheduled skills and feed, pre-meeting briefs, follow-up drafts.
- **P4 — reach (L)**: extension, mobile, Teams bot, integrations (Slack, Notion,
  CRM, PM tools), API keys/webhooks, MCP server.
- **P5 — governance & polish (M)**: SSO/SAML/SCIM, retention, legal hold, audit,
  analytics, conversation intelligence, accessibility pass, parity diff.

Next step: `/replica-architect` — turn this map into the schema, API routes,
provider interfaces and build order for P0.
