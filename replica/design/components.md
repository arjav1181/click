# Click design system — component specs

Primitives built once, in isolation, before any screen. Production implementations
land in `packages/ui` during M0 and use Radix primitives where possible. A static
preview of all of them lives at `replica/design/preview.html` (rendered with the
tokens in `tokens.css`).

Tokens are referenced by role name (`bg`, `text-muted`, `accent`, `radius-md`,
`shadow-card`), never by raw hex. Dark mode is handled by `tokens.css`.

---

## Button
- variants: primary, secondary, ghost, danger, icon
- sizes: sm 32px, md 40px, lg 48px (icon: sm 28, md 32, lg 40)
- states: default, hover, active, focus-visible (2px ring, accent), disabled, loading
- tokens: primary `bg accent` `text on-accent`; secondary `bg surface` `border border`; ghost no bg; danger `bg danger` `text on-danger`; radius md; font sm/600; shadow none (primary gets shadow-card on hover)
- a11y: real `<button>`; `aria-busy` while loading; loading keeps the label for screen readers; disabled is not focusable only when truly inert
- used on: all

## Input / textarea
- variants: text, email, password, search, markdown (textarea)
- sizes: sm 32px, md 40px, lg 48px; textarea min-height 80px, auto-grow to 240
- states: default, focus, invalid, disabled, read-only
- tokens: bg surface, border border-input, text text, radius md, font base; invalid border danger + danger-soft bg; focus border focus + 2px ring
- a11y: associated `<label>` (or aria-label), `aria-invalid`, `aria-describedby` for help/error; never placeholder-only labels
- used on: all

## Select / combobox
- variants: single, multi, searchable
- sizes: md 40px trigger; popover max-height 320px
- states: closed, open, filtering, empty, disabled
- tokens: trigger like Input; popover bg surface, border border, radius lg, shadow pop; option hover surface-2; selected accent-soft text accent
- a11y: listbox/combobox roles, keyboard nav, type-ahead; `aria-expanded`, `aria-activedescendant`
- used on: settings, filters

## Dialog
- variants: info, confirm, destructive, form
- sizes: sm 400px, md 520px, lg 680px; full-screen under sm breakpoint
- states: open, submitting, error, success
- tokens: bg surface, radius lg, shadow pop; scrim rgba(17,24,39,.55); header border-b border
- a11y: focus trap, restore focus on close, Escape closes, `role="dialog"` `aria-modal`, labelled by title
- used on: all

## Drawer / side panel
- variants: left (nav), right (detail), bottom (mobile)
- sizes: left 248px, right 360/480px, bottom 80vh; resizable right rail
- states: open, resizing, collapsed
- tokens: bg surface, border-l/r border, shadow pop; scrim on mobile only
- a11y: focus trap, Escape closes, `aria-modal` only when blocking
- used on: S10, S22, S27

## Toast
- variants: info, success, warning, error
- sizes: 360px max, auto height
- states: auto-dismiss (5s), action, sticky
- tokens: bg surface, border border, radius md, shadow pop; left accent bar by variant; font sm
- a11y: `role="status"` / `role="alert"`; pause on hover; dismiss button labelled
- used on: all

## Tabs
- variants: underline, pill, segmented
- sizes: md 36px height
- states: default, active, disabled, overflow (scroll)
- tokens: underline active border-b-2 accent text accent; pill active bg accent-soft text accent; segmented container bg surface-2 radius md
- a11y: `role="tablist"`/`tab`/`tabpanel`, arrow keys, Home/End
- used on: S10, S11, S22

## Table
- variants: simple, sortable, selectable, virtualised
- sizes: row 44px; header sticky
- states: empty, loading, filled, error
- tokens: header bg surface-2 text-muted font sm/600; row border-b border; hover surface-2; selected accent-soft; radius 0 (container lg)
- a11y: semantic `<table>`, `aria-sort`, row selection via checkbox; keyboard row nav
- used on: S08, S36, S53, S58

## Badge / chip
- variants: status, tag, filter, citation
- sizes: sm 20px, md 24px
- states: neutral, success, warning, danger, removable
- tokens: radius pill; font xs/500; neutral bg surface-2 text-muted; success bg success-soft text success; etc.; citation variants see Citation chip
- a11y: removable chips have a labelled close button; status badges are not interactive
- used on: all

## Avatar
- variants: user, bot, company
- sizes: xs 20, sm 24, md 32, lg 40, xl 56
- states: image, initials, fallback, group (stacked)
- tokens: radius pill (bot/company square md); bg surface-2; text-muted; border 2px surface on groups
- a11y: `alt` for images; initials are decorative when name is adjacent
- used on: S24, S28, S53

## Empty state
- variants: page, panel, search, filtered
- sizes: illustration 120–160px
- states: illustration, title, action, secondary link
- tokens: title font lg/600 text; body text-muted; illustration muted (never brand marks of originals)
- a11y: illustration `aria-hidden`; action is a real button/link
- used on: all

## Skeleton
- variants: line, card, table, transcript
- states: loading, reduced motion (static)
- tokens: bg surface-2; shimmer via `motion-base` ease; radius matches target
- a11y: `aria-busy`, `aria-live="polite"` on container; respect `prefers-reduced-motion`
- used on: all

## Transcript segment
- variants: speaker, paragraph, search-hit, edited
- states: live, final, highlighted, editing, selected
- tokens: font base; speaker label font sm/600; timestamp font xs mono text-muted; search-hit bg warning-soft; edited marker text-muted xs; selected bg accent-soft
- a11y: timestamps are links; edit mode uses contenteditable with undo; live region for streaming
- used on: S09, S13, S14

## Speaker label
- variants: named, unnamed, "me"/"them", merged
- states: default, editable, conflict
- tokens: font sm/600; unnamed text-muted italic; "me" accent; conflict warning
- a11y: editable via button + popover; merge conflicts announced
- used on: S13, S48

## Timestamp link
- variants: inline, block
- states: default, hover, active
- tokens: font xs mono text-muted; hover accent underline; active accent
- a11y: real `<button>`/`<a>` with `aria-label="Jump to 12:34"`
- used on: S11, S13, S15

## Citation chip
- variants: "you", "AI", transcript, document
- states: default, hover preview, broken
- tokens: radius pill; font xs/500; "you" bg surface-2 text; "AI" bg accent-soft text accent; transcript bg surface-2 text-muted; document bg surface-2; broken danger-soft text danger
- a11y: button with `aria-label` including source; preview in popover; broken state announced
- used on: S11, S37

## Audio player
- variants: compact, full, video
- states: idle, playing, buffering, unavailable, error
- tokens: bg surface, border border, radius md; controls accent; unavailable text-muted with icon
- a11y: native `<audio>`/`<video>` controls or ARIA slider with keyboard; captions track
- used on: S14, S25

## Waveform
- variants: live input, playback, clip
- states: idle, live, muted, unavailable
- tokens: bars accent-soft/accent; muted text-muted; unavailable surface-2
- a11y: `aria-hidden` (decorative) or labelled region with current time
- used on: S19, S64, S71

## Recording indicator
- variants: bot, desktop, mobile, extension
- states: recording, paused, consent-pending
- tokens: dot danger (pulse) + label text; paused warning; consent-pending accent
- a11y: `role="status"` with live text; respect reduced motion (no pulse)
- used on: all capture surfaces

## Progress stepper
- variants: onboarding, upload, bot join
- states: pending, active, done, error
- tokens: step circle 24px; done accent fill + check; active accent ring; pending surface-2; error danger
- a11y: `aria-current="step"`; completed steps announced
- used on: S04, S42, S61

## Calendar event card
- variants: upcoming, live, past
- sizes: md 88px height
- states: default, joinable, recording, cancelled
- tokens: bg surface, border border, radius md; live accent-soft border accent; recording danger dot; cancelled text-muted strikethrough
- a11y: card is a button/link with full label
- used on: S07, S65

## Meeting card
- variants: list, grid, compact
- states: default, hover, selected, processing, failed
- tokens: bg surface, border border, radius md, shadow card; hover shadow pop; processing accent-soft; failed danger-soft; selected accent ring
- a11y: selectable via checkbox; status announced
- used on: S07, S08

## Folder tree
- variants: spaces, folders, nested
- states: expanded, collapsed, drag-over, locked
- tokens: row 32px; indent 16px; hover surface-2; drag-over accent-soft border accent (dashed); locked text-muted
- a11y: tree role, arrow keys, type-ahead; drag-and-drop keyboard alternative
- used on: S27

## Channel list
- variants: public, private, archived
- states: default, unread, muted
- tokens: row 36px; unread bold text; muted text-muted; archived text-muted + icon
- a11y: list with `aria-current` for active channel
- used on: S26

## Chat message
- variants: user, assistant, system, tool
- states: streaming, sent, stopped, error, cited
- tokens: user bg surface-2; assistant bg surface border border; system text-muted italic; tool bg accent-soft; streaming caret accent; cited shows citation chips
- a11y: live region while streaming; stop button labelled; errors announced
- used on: S37, S38, S73

## Prompt composer
- variants: text, with attachments, voice
- states: empty, focused, sending, disabled, over budget
- tokens: bg surface, border border-input, radius lg; focus ring accent; over-budget border danger; attachment chips surface-2
- a11y: textarea with label; send button disabled until non-empty; char/token count `aria-live`
- used on: S37, S38

## Command menu
- variants: slash commands, templates, actions
- states: closed, open, filtered, no results
- tokens: popover bg surface, radius lg, shadow pop; item hover surface-2; selected accent-soft; font sm
- a11y: combobox + listbox; keyboard nav; Escape closes
- used on: S12, S37

## Template card
- variants: built-in, custom, shared
- states: default, selected, preview
- tokens: bg surface, border border, radius md, shadow card; selected accent ring; built-in badge neutral
- a11y: selectable card with labelled action
- used on: S30

## Recipe card
- variants: discover, mine, workspace
- states: default, running, shared, remixable
- tokens: bg surface, border border, radius md; running accent-soft + spinner; shared accent badge
- a11y: status announced; remix action labelled
- used on: S31

## Task row
- variants: inline, table, board
- states: open, done, overdue, pushed, failed
- tokens: checkbox 16px; done text-muted strikethrough; overdue danger; pushed accent; failed danger + retry
- a11y: checkbox with label; due date as time element
- used on: S16, S36

## Sentiment bar
- variants: meeting, speaker
- states: neutral, mixed, positive, negative, no data
- tokens: 8px height radius pill; positive success, negative danger, neutral text-muted; no data surface-2
- a11y: `role="img"` with `aria-label` summarising the score; never colour-only (label adjacent)
- used on: S17, S57

## Talk-time bar
- variants: per speaker
- states: default, hover, no data
- tokens: stacked horizontal bars, height 8px; per-speaker colour from a fixed accessible palette (not brand accent)
- a11y: legend with names; `aria-label` per segment
- used on: S17

## Consent banner
- variants: bot, desktop, mobile, extension
- states: required, acknowledged, declined
- tokens: bg warning-soft border warning radius md; acknowledged success-soft; declined danger-soft
- a11y: `role="alert"` when required; explicit acknowledge/decline buttons
- used on: capture surfaces

## Retention banner
- variants: info, warning, locked
- states: default, applying, legal hold
- tokens: info surface-2; warning warning-soft; locked danger-soft; radius md
- a11y: status text not colour-only
- used on: S51, S59

## Plan/limit banner
- variants: n/a (no plans)
- states: budget warning, budget exhausted
- tokens: warning-soft border warning; exhausted danger-soft border danger; radius md
- a11y: announced; link to admin settings
- used on: S37, S56

## Provider card
- variants: ASR, LLM, storage, email
- states: unconfigured, testing, ok, error
- tokens: bg surface, border border, radius md; status dot per state; error danger-soft
- a11y: status announced; test button labelled
- used on: S56, S60

## Integration card
- variants: connected, available, unavailable
- states: default, connecting, connected, error, reauth
- tokens: bg surface, border border, radius md; connected success dot; error danger-soft
- a11y: status announced; connect/reauth buttons labelled
- used on: S44

## Key row
- variants: API key, webhook
- states: active, revoked, failing
- tokens: bg surface, border border, radius md; revoked text-muted strikethrough; failing danger
- a11y: reveal/copy actions labelled; secret never shown in full after creation
- used on: S45

## Audit row
- variants: event
- states: default, expanded
- tokens: row 44px; expanded bg surface-2; font sm; mono for ids/timestamps
- a11y: expand button labelled; details in a region
- used on: S58

## Theme toggle
- variants: light, dark, system
- states: selected
- tokens: segmented control; selected bg surface shadow card
- a11y: `role="radiogroup"`; labelled
- used on: all

## Language picker
- variants: transcription, summary, UI
- states: default, auto-detect, unsupported
- tokens: select-like; unsupported warning
- a11y: labelled; unsupported announced
- used on: S04, S47

## Keyboard shortcut hint
- variants: inline, modal
- states: default
- tokens: kbd bg surface-2 border border radius sm font xs mono
- a11y: `<kbd>` element; modal lists all shortcuts
- used on: S47, S64

## Pagination
- variants: cursor, page numbers
- states: default, first, last, loading
- tokens: button ghost sm; current page accent-soft text accent
- a11y: `aria-current="page"`; labelled nav
- used on: S08, S58

## Upload dropzone
- variants: audio, video, bulk
- states: idle, drag-over, uploading, error
- tokens: border dashed border-input radius lg; drag-over accent border + accent-soft bg; uploading progress accent; error danger
- a11y: `role="button"` with keyboard activation; progress `aria-valuenow`
- used on: S42

## QR / pairing block
- variants: desktop, mobile
- states: waiting, paired, expired
- tokens: bg surface border border radius lg; QR on white; expired text-muted
- a11y: QR `alt` with code; expiry announced
- used on: S64
