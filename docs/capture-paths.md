# Capture paths: what actually works in 2026

Click needs meeting audio and, where possible, participant identity. There is no
single API that covers every provider, so the bot runner is a set of adapters
behind one contract. This note records what each path can and cannot do, why the
default is what it is, and what we refuse to pretend. Sources are linked at the
bottom.

## Summary

| Provider | Default path | Real-time? | Credentials | Notes |
| --- | --- | --- | --- | --- |
| Google Meet | Browser bot (opt-in per workspace) | Yes, with the WebRTC audio tap | A dedicated Google account, none for a guest join | Fragile by nature. The bot is visible and posted as such. |
| Google Meet | Meet REST API import | No, after the call | Workspace OAuth + Drive access | Best-quality transcript/recording when the organizer records in Meet. |
| Zoom | RTMS (official) | Yes | Zoom app + host authorisation + credits | No fake participant. Marketplace review is not required for self-hosted credentials. |
| Zoom | Browser bot fallback | Yes | None | Same fragility as Meet; kept behind the same opt-in. |
| Microsoft Teams | Graph transcript import | No, after the call | Tenant admin consent, `OnlineMeetingTranscript.Read.All` | Admin can disable Graph transcript access; the UI must say so. |
| Microsoft Teams | Bot Framework + application-hosted media | Yes | Tenant admin consent | Significantly more work. Not in the first bot milestone. |
| Webex | Browser bot fallback | Yes | None | P4. |
| Jitsi | Browser bot | Yes | None | Easiest browser target; useful as the canary. |
| Any | Desktop / extension local capture | Yes | None | Records the user's own tab or system audio. No bot in the call. |

## Google Meet Media API is gone

The Google reference repository for the Meet Media API carries a deprecation
notice: the API "has been discontinued and will not advance to General
Availability (GA)". Planning around it would be planning around a product that
will not ship. The architecture note that called it the preferred path is
outdated; this document is the replacement decision.

What remains official for Meet:

- **Meet REST API** — meeting spaces, conference records, participants, and
  post-meeting artifacts (recordings, transcripts, transcript entries, smart
  notes). Transcript entries are speech segments with participant identity and
  language, retained for 30 days after the conference. Recording and transcript
  files live in the organizer's Drive.
- **Google Workspace Events** — lifecycle notifications for spaces and
  conferences, so a self-hosted instance can react when a call ends instead of
  polling blindly.

Neither gives a third-party app live audio. For real-time Meet capture the only
paths left are a browser participant, a user-side capture (extension/desktop),
or an external bot provider.

## Browser bot: the honest version

A headless (or headed under Xvfb) Chromium joins the meeting URL like a person:
enter a guest name, ask to join, wait in the lobby, then capture the remote
audio tracks from the page's own WebRTC peer connections.

The audio tap is a page script injected before navigation. It wraps
`RTCPeerConnection`, mirrors every remote audio track into a hidden
`<audio>` element, mixes those streams in a Web Audio graph, resamples to
16 kHz mono, and sends PCM to the runner over a Playwright binding. The runner
writes a WAV file, uploads it to the existing bot recording callback, and the
normal transcription pipeline takes over. No PulseAudio, no virtual sink, no
OS-level loopback device — the browser already has the decoded audio.

This is deliberately a fallback, not a promise:

- provider terms and bot-detection can change without notice;
- a host can deny the bot, and the bot must report `lobby_denied`, not retry
  forever;
- a guest bot has no calendar identity, so speaker names come from the meeting
  UI or from post-call attribution, not from an authenticated profile;
- it is opt-in per workspace, with a plain-language warning in the admin UI;
- the bot is always visible, uses the workspace's configured bot name, and
  attempts to post the consent notice in the meeting chat;
- repeated join failures disable the path instead of burning through retries.

The same WebRTC tap is the basis of the browser extension later: at
`document_start` it can mirror the call audio in the user's own tab, which is
the most reliable Meet capture path and works when a host refuses bots.

## Why not just scrape captions?

Captions are text, not audio. They are often disabled by the host, localized
differently from the spoken language, and lose punctuation and speaker turns.
They are useful as a hint (and as an in-meeting display), but they cannot feed
the transcription, vocabulary, or audio-retention pipeline. Click captures audio.

## Official adapters and external providers

- **Zoom RTMS** streams live audio, video, and transcript data for Meetings,
  Contact Center, and the Video SDK. It needs credits on the Zoom account and
  the host's authorisation; there is no bot in the call.
- **Microsoft Teams** can expose post-meeting transcripts through Graph. Tenant
  admins can turn that off (`GraphAccessToTranscriptsDisabled`), so the product
  must surface the admin action instead of silently showing an empty meeting.
- **External bot providers** (for example Vexa, which is Apache-2.0, or a hosted
  service) can be plugged in behind the same `MeetingJoiner` contract. This is
  attractive for operators who do not want to run Chromium, and it keeps the
  door open without making a vendor part of Click's core.

## What Click ships now

1. `apps/bot` with a Playwright runner: HMAC-authenticated join requests,
   per-job browser session, Meet and Jitsi join adapters, WebRTC audio capture,
   WAV upload, lifecycle callbacks, stop, duration cap, and a provider circuit
   breaker.
2. The admin recording screen gets an explicit browser-bot opt-in. Until it is
   on, manual and calendar-created bot jobs fail with `browser_bot_disabled`
   instead of starting a browser.
3. Zoom, Teams, and Webex return a specific `provider_requires_official_adapter`
   error until their official adapters exist. No fake join.
4. Meet REST import and Zoom RTMS stay on the roadmap as separate adapters; they
   are not emulated by the browser bot.

## Sources

- Google Meet Media API samples, deprecation notice:
  <https://github.com/googleworkspace/meet-media-api-samples>
- Google Meet REST API overview:
  <https://developers.google.com/workspace/meet/api/guides/overview>
- Microsoft Graph: list transcripts for an online meeting:
  <https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts>
- Zoom Realtime Media Streams:
  <https://developers.zoom.us/docs/rtms/>
- Vexa (Apache-2.0) prior art for browser meeting bots:
  <https://github.com/Vexa-ai/vexa>
