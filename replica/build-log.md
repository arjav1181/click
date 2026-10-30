# Build log — Click

One line per screen built. Format: `ID | date | status | notes`.

- S01 | 2026-10-28 | partial | Login form (email/password) redirects to /app; no real auth backend yet.
- S02 | 2026-10-28 | partial | Signup form redirects to onboarding; invite token route is a stub.
- S04 | 2026-10-28 | partial | 4-step onboarding wizard with stepper; choices not persisted.
- S07 | 2026-10-28 | partial | Home with upcoming events, recent meetings, quick capture, AI budget chip.
- S08 | 2026-10-28 | partial | Meetings library with search and status filter; list/grid toggle not yet.
- S10 | 2026-10-28 | partial | Meeting workspace with AI notes / raw notes / transcript tabs, outline, action items, player stub.
- S11 | 2026-10-28 | partial | AI notes tab renders sections + citation chips; regenerate wired to fake layer.
- S12 | 2026-10-28 | partial | Raw notes textarea with save; slash menu not yet.
- S13 | 2026-10-28 | partial | Transcript tab renders segments with speakers and timestamps; editing not yet.
- S41 | 2026-10-28 | partial | Search page with results linking to meetings; filters not yet.
- S42 | 2026-10-28 | partial | Import page with dropzone, progress and completion; cancel/retry not yet.
- S03,S05,S06,S09,S14-S24,S25-S40,S43-S63 | 2026-10-28 | stub | Routing in place; screens not yet implemented (M2-M6).
- S64-S74 | 2026-10-28 | out-of-web | Desktop/extension/mobile/bot clients and error states live outside the web app.

## Backend phase (replica-backend) — 2026-10-29

Screens below moved from the bundled demo data to the real API. See
[`backend.md`](backend.md) for the route inventory, job list and known gaps.

- S01 | 2026-10-29 | done | Login posts to `/api/v1/auth/login`; scrypt password, session cookie, rate limited, magic-link option. Error states surfaced.
- S02 | 2026-10-29 | done | Signup posts to `/api/v1/auth/register`; creates the user and a first workspace, sends a verification email.
- S03 | 2026-10-29 | done | Magic-link page consumes `/api/v1/auth/magic-link/consume` and signs the user in.
- S06 | 2026-10-29 | done | Workspace guard on the shell layout: unauthenticated visits to `/app/**` redirect to `/login?next=…`.
- S07 | 2026-10-29 | partial | Home reads recent meetings and the usage/budget summary from the API; calendar events still demo data.
- S08 | 2026-10-29 | partial | Meetings library reads `/api/v1/meetings` with server-side title and status filters.
- S10 | 2026-10-29 | partial | Meeting workspace reads the meeting, transcript, note and action items from the API.
- S11 | 2026-10-29 | partial | Notes regenerate through `/api/v1/meetings/[id]/notes/generate`; sections and citations come from the database.
- S12 | 2026-10-29 | partial | Raw notes save through `PUT /api/v1/meetings/[id]/notes`; slash menu not yet.
- S13 | 2026-10-29 | partial | Transcript renders segments from the database; segment editing endpoint exists, UI not yet.
- S41 | 2026-10-29 | partial | Search queries `/api/v1/search` (keyword, tsvector + trigram); filters and semantic mode not yet in the UI.
- S42 | 2026-10-29 | partial | Import posts multipart audio to `/api/v1/uploads`; the meeting appears and is transcribed in the background.
- S47 | 2026-10-29 | partial | Profile settings read and write `/api/v1/settings/profile`.
- S53 | 2026-10-29 | partial | Members list reads `/api/v1/org/members`; invite form posts `/api/v1/org/invites`; role changes not yet in the UI.
- S58 | 2026-10-29 | partial | Audit log reads `/api/v1/org/audit`.
- S56 | 2026-10-29 | partial | Provider admin reads `/api/v1/admin/providers`; BYOK test endpoint exists, UI not yet.
- S55 | 2026-10-29 | partial | Retention and budget settings shown in the usage endpoint; editing not yet.
- New | 2026-10-29 | done | Forgot-password, reset-password, verify-email and invite-accept pages wired to the API.
- New | 2026-10-29 | done | Shell header shows the signed-in user and workspace and signs out.
- S36 | 2026-10-29 | done | Tasks screen over GET /api/v1/action-items: status and text filters, grouping by meeting/due/owner, bulk complete, CSV export, overdue badges.
- S27 | 2026-10-29 | partial | Folders and spaces over GET/POST /api/v1/folders and /api/v1/spaces: nested tree, create dialogs, folder page with meetings and move. Drag-and-drop filing and auto-add rules not built. Fixed a repo bug where correlated subqueries compared the wrong id column, so folder names, transcript flags and summaries were wrong.
- S26 | 2026-10-29 | partial | Channels over GET/POST/PATCH /api/v1/channels: list, detail with meetings and members, archive/restore, private/public. Channel chat, auto-filing and per-team overrides not built.
- S53 | 2026-10-29 | done | Admin members over GET /api/v1/org/members, PATCH /api/v1/org/members/[id] and POST /api/v1/org/invites: search and status filters, inline role change, deactivate/reactivate, invitation dialog with dev sign-in link.
- S58 | 2026-10-29 | done | Admin audit log over GET /api/v1/org/audit: event table with action, actor, target and date filters, detail drawer with metadata, CSV export and pagination. Added an admin history to the demo seed.
- S56 | 2026-10-29 | done | Admin AI policy over GET/PATCH /api/v1/admin/ai-policy and /api/v1/admin/ai-policy/providers: provider cards with configured/missing key/disabled states, encrypted bring-your-own-key storage, monthly budget cap with spend meter and hard-stop warning, and per-feature gates for transcription, summaries, action items and semantic search. The gates and the cap now drive the runtime, and BYOK provider overrides replace the env defaults in the transcribe, summarize and embed jobs.
- S47 | 2026-10-30 | done | Personal settings over GET/PATCH /api/v1/settings/profile: profile card with avatar and verified badge, display name, avatar URL, interface language and time zone, links to the related settings screens, and a sticky save bar with discard. The shared Avatar component now accepts an image source, and the profile API accepts an avatar URL.
- S06 | 2026-10-30 | done | Workspace setup at `/admin/general` over the real API: GET/PATCH /api/v1/org for the workspace name and logo, PUT /api/v1/org for the auto-summarize, default language and default visibility knobs, POST/DELETE /api/v1/org/domains for the auto-join domain list with cross-workspace conflict detection, and POST /api/v1/org/ownership plus DELETE /api/v1/org for the danger zone (transfer ownership and delete after typing the exact name). The workspace defaults live beside the AI policy in the organization settings blob, so both survive each other's writes.
- S43 | 2026-10-30 | done | Export centre at `/app/export`: meeting picker with search, select-all and per-meeting badges, a format picker for md, txt, pdf, docx, srt, vtt, json and mp3, and a download that writes one file or a zip archive with one file per meeting. The text formats are rendered in `packages/backend/src/export.ts` (the PDF is written byte by byte and the Word document is a zip of OOXML parts), the single-meeting download streams the stored recording for mp3, and POST /api/v1/export bundles many meetings into one archive. The meeting screen links here with `?meeting=<id>` so the meeting is preselected.
- S30 | 2026-10-30 | done | Templates at `/app/templates` over GET/POST/PATCH/DELETE /api/v1/templates: a grid of built-in and custom templates with scope badges, a section builder that adds, removes and reorders sections, a prompt editor, a live preview, and personal or workspace visibility. Built-in templates are read-only, and the notes generator already references `template_id` when writing a summary.
- S45 | 2026-10-30 | done | Developers at `/app/developers`: API keys with scoped permissions (create, list, revoke; the raw key is shown once) and webhook endpoints with event selection, pause/resume, delete and a delivery log. Backed by GET/POST/DELETE /api/v1/api-keys, GET/POST/PATCH/DELETE /api/v1/webhooks and GET /api/v1/webhooks/[id]/deliveries.
- S37 | 2026-10-30 | done | Ask AI at `/app/ask`: a thread list with new chat and delete, a scope picker for all meetings, folders and channels, a composer with Ctrl/Cmd+Enter to send, and answers with citation chips linking back to the meeting and timestamp. Backed by GET/POST /api/v1/chat/threads, GET/DELETE /api/v1/chat/threads/[id] and POST /api/v1/chat/threads/[id]/messages, which gathers transcript snippets and calls the LLM chat provider (mock heuristic or real OpenAI-compatible endpoint).
- S23,S25 | 2026-10-30 | done | Share dialog on the meeting page over GET/POST/DELETE /api/v1/meetings/[id]/shares (link, domain or password-protected, revoke) plus a public recap at /r/[token] that resolves the token, checks expiry and revocation, prompts for a password when needed, and renders the notes and transcript under the owning org's tenant context.
- S44 | 2026-10-30 | done | Integration hub at `/app/integrations`: category tabs, search, cards with connected/disconnected status, a connect dialog that stores JSON config, and disconnect. Backed by GET/POST /api/v1/integrations and PATCH/DELETE /api/v1/integrations/[key].
- S48 | 2026-10-30 | done | Speaker management at `/settings/speakers`: rename a speaker and merge duplicates (segments are reassigned and the source is marked merged). Backed by GET /api/v1/speakers, PATCH /api/v1/speakers/[id] and POST /api/v1/speakers/merge.
- S49 | 2026-10-30 | done | Vocabulary at `/settings/vocabulary`: add names, terms and acronyms with personal or workspace scope, duplicate detection, and remove. Backed by GET/POST /api/v1/vocabulary and DELETE /api/v1/vocabulary/[id].
- S51 | 2026-10-30 | done | Retention at `/settings/retention`: recording mode (audio, audio+video, transcript-only), auto-delete for transcripts and audio, and a legal-hold override. Backed by GET/PUT /api/v1/retention over the retention_policies table.
- S55 | 2026-10-30 | done | Admin recording policy at `/admin/recording`: auto-join default, bot display name, consent notice text and private-by-default. Backed by GET/PUT /api/v1/admin/recording stored in the organization settings blob.
- S57 | 2026-10-30 | done | Admin analytics at `/admin/analytics`: member count, ASR seconds, LLM tokens in/out, cost estimate, budget cap and period. Backed by GET /api/v1/org/usage and GET /api/v1/org/members.
