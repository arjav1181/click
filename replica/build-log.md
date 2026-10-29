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
