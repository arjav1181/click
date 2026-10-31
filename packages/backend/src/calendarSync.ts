/**
 * Calendar sync and auto-join.
 *
 * A sync pulls the next two weeks of events from Google Calendar or Microsoft
 * Graph, stores them and decides which meetings get a bot. Auto-join is the
 * combination of the per-event override, the workspace rules and the
 * per-calendar default.
 */
import { botsRepo, calendarsRepo, meetingsRepo } from "@click/db";
import { decryptSecret } from "./crypto";
import {
  calendarAccountEmail,
  isCalendarProviderConfigured,
  listCalendarEvents,
  refreshCalendarToken,
  type CalendarProviderName,
} from "./calendar";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";
const SYNC_WINDOW_DAYS = 14;
const JOIN_LEAD_MINUTES = 20;

export interface CalendarRule {
  id: string;
  connectionId: string | null;
  titlePattern: string | null;
  hostPattern: string | null;
  attendeeEmail: string | null;
  autoJoin: boolean;
  priority: number;
}

export interface SyncEvent {
  title: string | null;
  meetingUrl: string | null;
  attendees: Array<{ email: string; name: string | null }>;
}

function matchesRule(rule: CalendarRule, event: SyncEvent, connectionId: string): boolean {
  if (rule.connectionId && rule.connectionId !== connectionId) return false;
  if (rule.titlePattern) {
    const title = (event.title ?? "").toLowerCase();
    if (!title.includes(rule.titlePattern.toLowerCase())) return false;
  }
  if (rule.hostPattern) {
    const url = event.meetingUrl ?? "";
    if (!url.toLowerCase().includes(rule.hostPattern.toLowerCase())) return false;
  }
  if (rule.attendeeEmail) {
    const emails = event.attendees.map((attendee) => attendee.email.toLowerCase());
    if (!emails.includes(rule.attendeeEmail.toLowerCase())) return false;
  }
  return true;
}

/** The workspace rule that applies to an event, lowest priority number first. */
export function resolveAutoJoin(
  rules: CalendarRule[],
  event: SyncEvent,
  connectionId: string,
  connectionAutoJoin: boolean,
): boolean {
  const match = rules
    .filter((rule) => matchesRule(rule, event, connectionId))
    .sort((a, b) => a.priority - b.priority)[0];
  return match ? match.autoJoin : connectionAutoJoin;
}

export function providerForUrl(url: string | null): "zoom" | "teams" | "meet" | "webex" | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith("zoom.us") || host.endsWith("zoomgov.com")) return "zoom";
  if (host.endsWith("meet.google.com")) return "meet";
  if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "teams";
  if (host.endsWith("webex.com")) return "webex";
  return null;
}

export interface SyncResult {
  connectionId: string;
  provider: CalendarProviderName;
  events: number;
  queuedBots: number;
  error?: string;
}

export async function syncCalendarConnection(
  orgId: string,
  connectionId: string,
  options: { queueBot?: (job: { orgId: string; botJobId: string }) => Promise<void> } = {},
): Promise<SyncResult> {
  const ctx = { orgId, userId: SYSTEM_USER };
  const connection = await calendarsRepo.getCalendarConnection(ctx, connectionId);
  if (!connection) throw new Error("Calendar connection not found.");

  const provider = connection.provider as CalendarProviderName;
  if (!isCalendarProviderConfigured(provider)) {
    return {
      connectionId,
      provider,
      events: 0,
      queuedBots: 0,
      error: `${provider.toUpperCase()}_CLIENT_ID is not set, so the calendar cannot be synced.`,
    };
  }
  if (connection.refreshTokenEnc === "placeholder") {
    return {
      connectionId,
      provider,
      events: 0,
      queuedBots: 0,
      error: "This calendar has no OAuth token yet. Connect it again to finish the consent flow.",
    };
  }

  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  const tokens = await refreshCalendarToken(provider, refreshToken);
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date(Date.now() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await listCalendarEvents(provider, tokens.accessToken, from, to);

  await calendarsRepo.upsertCalendarEvents(ctx, connectionId, [
    ...events.map((event) => ({
      externalId: event.externalId,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      organizerEmail: event.organizerEmail,
      attendees: event.attendees,
      meetingUrl: event.meetingUrl,
      provider,
    })),
  ]);

  const rules = (await calendarsRepo.listCalendarRules(ctx)) as CalendarRule[];
  const stored = await calendarsRepo.listConnectionEvents(ctx, connectionId, { from, to });

  let queuedBots = 0;
  for (const event of stored) {
    const ruleDecision = resolveAutoJoin(
      rules,
      { title: event.title, meetingUrl: event.meetingUrl, attendees: event.attendees },
      connectionId,
      connection.autoJoin,
    );
    // A manual per-event override always wins over the rules. The override is
    // never written back: a null override keeps following the rules.
    const effective = event.autoJoin ?? ruleDecision;

    const startsInMs = event.startsAt.getTime() - Date.now();
    const joinable = providerForUrl(event.meetingUrl);
    if (!effective || !joinable) continue;
    if (startsInMs < -5 * 60_000 || startsInMs > JOIN_LEAD_MINUTES * 60_000) continue;
    if (event.botStatus !== "none") continue;

    const meeting = await meetingsRepo.createMeeting(ctx, {
      title: event.title ?? "Untitled meeting",
      source: "bot",
      status: "scheduled",
      startedAt: event.startsAt,
      calendarEventId: event.id,
    });
    const job = await botsRepo.createBotJob(ctx, {
      meetingId: meeting.id,
      provider: joinable,
      meetingUrl: event.meetingUrl!,
      calendarEventId: event.id,
      idempotencyKey: `auto:${event.id}`,
      scheduledAt: event.startsAt,
    });
    await calendarsRepo.setEventBotStatus(ctx, event.id, "scheduled");
    queuedBots += 1;
    if (options.queueBot) await options.queueBot({ orgId, botJobId: job.id });
  }

  return { connectionId, provider, events: events.length, queuedBots };
}

/** Stores the OAuth result of a consent flow and starts the first sync. */
export async function completeCalendarConnection(
  orgId: string,
  userId: string,
  provider: CalendarProviderName,
  tokens: { accessToken: string; refreshToken: string | null; accountEmail: string | null },
): Promise<{ id: string }> {
  const ctx = { orgId, userId };
  const email = tokens.accountEmail ?? `${provider}@calendar.local`;
  if (!tokens.refreshToken) throw new Error("The calendar provider did not return a refresh token.");
  const { encryptSecret } = await import("./crypto");
  const connection = await calendarsRepo.saveCalendarTokens(ctx, {
    provider,
    accountEmail: email,
    refreshTokenEnc: encryptSecret(tokens.refreshToken),
  });
  return connection;
}

export async function calendarAccount(
  provider: CalendarProviderName,
  accessToken: string,
): Promise<string | null> {
  return calendarAccountEmail(provider, accessToken);
}
