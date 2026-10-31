/**
 * Calendar provider clients (Google Calendar, Microsoft Graph).
 *
 * Only the official APIs are used. Each provider exposes the same four steps:
 * build the consent URL, exchange the code, refresh the access token and list
 * events for a time window. Tokens are encrypted at rest by the caller.
 */
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./env";

export type CalendarProviderName = "google" | "microsoft";

export interface CalendarProviderEvent {
  externalId: string;
  title: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  organizerEmail: string | null;
  attendees: Array<{ email: string; name: string | null }>;
  meetingUrl: string | null;
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  accountEmail: string | null;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function calendarConfig(provider: CalendarProviderName): ProviderConfig {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `${appUrl()}/api/v1/calendars/providers/google/callback`,
    };
  }
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? `${appUrl()}/api/v1/calendars/providers/microsoft/callback`,
  };
}

export function isCalendarProviderConfigured(provider: CalendarProviderName): boolean {
  const config = calendarConfig(provider);
  return Boolean(config.clientId && config.clientSecret);
}

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function calendarAuthorizeUrl(provider: CalendarProviderName, state: string, challenge: string): string {
  const config = calendarConfig(provider);
  if (!config.clientId) throw new Error(`${provider.toUpperCase()}_CLIENT_ID is not set.`);
  const url =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") {
    url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  } else {
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "offline_access User.Read Calendars.Read");
  }
  return url.toString();
}

async function tokenRequest(provider: CalendarProviderName, body: URLSearchParams): Promise<Record<string, unknown>> {
  const config = calendarConfig(provider);
  const endpoint =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Calendar token request failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function exchangeCalendarCode(
  provider: CalendarProviderName,
  code: string,
  verifier: string,
): Promise<CalendarTokens> {
  const config = calendarConfig(provider);
  const tokens = await tokenRequest(
    provider,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }),
  );
  return {
    accessToken: String(tokens.access_token ?? ""),
    refreshToken: tokens.refresh_token ? String(tokens.refresh_token) : null,
    expiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
    accountEmail: null,
  };
}

export async function refreshCalendarToken(provider: CalendarProviderName, refreshToken: string): Promise<CalendarTokens> {
  const config = calendarConfig(provider);
  const tokens = await tokenRequest(
    provider,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: provider === "google" ? "https://www.googleapis.com/auth/calendar.readonly" : "offline_access User.Read Calendars.Read",
    }),
  );
  return {
    accessToken: String(tokens.access_token ?? ""),
    refreshToken: tokens.refresh_token ? String(tokens.refresh_token) : refreshToken,
    expiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
    accountEmail: null,
  };
}

async function googleAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { email?: string };
  return body.email ? body.email.toLowerCase() : null;
}

export async function listCalendarEvents(
  provider: CalendarProviderName,
  accessToken: string,
  from: Date,
  to: Date,
): Promise<CalendarProviderEvent[]> {
  if (provider === "google") {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", from.toISOString());
    url.searchParams.set("timeMax", to.toISOString());
    url.searchParams.set("maxResults", "250");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Google Calendar returned ${response.status}.`);
    const body = (await response.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        description?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        organizer?: { email?: string };
        attendees?: Array<{ email?: string; displayName?: string }>;
        hangoutLink?: string;
        location?: string;
      }>;
    };
    return (body.items ?? []).map((item) => {
      const startsAt = new Date(item.start?.dateTime ?? item.start?.date ?? from.toISOString());
      const endsAt = new Date(item.end?.dateTime ?? item.end?.date ?? startsAt.getTime() + 30 * 60_000);
      return {
        externalId: item.id,
        title: item.summary ?? null,
        description: item.description ?? null,
        startsAt,
        endsAt: endsAt.getTime() > startsAt.getTime() ? endsAt : new Date(startsAt.getTime() + 30 * 60_000),
        organizerEmail: item.organizer?.email?.toLowerCase() ?? null,
        attendees: (item.attendees ?? [])
          .filter((attendee) => attendee.email)
          .map((attendee) => ({ email: attendee.email!.toLowerCase(), name: attendee.displayName ?? null })),
        meetingUrl: item.hangoutLink ?? item.location ?? null,
      };
    });
  }

  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", from.toISOString());
  url.searchParams.set("endDateTime", to.toISOString());
  url.searchParams.set("$top", "100");
  url.searchParams.set("Prefer", "outlook.timezone=\"UTC\"");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Microsoft Graph returned ${response.status}.`);
  const body = (await response.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      organizer?: { emailAddress?: { address?: string } };
      attendees?: Array<{ emailAddress?: { address?: string; name?: string } }>;
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
    }>;
  };
  return (body.value ?? []).map((item) => {
    const startsAt = new Date(item.start?.dateTime ?? from.toISOString());
    const endsAt = new Date(item.end?.dateTime ?? startsAt.getTime() + 30 * 60_000);
    return {
      externalId: item.id,
      title: item.subject ?? null,
      description: item.bodyPreview ?? null,
      startsAt,
      endsAt: endsAt.getTime() > startsAt.getTime() ? endsAt : new Date(startsAt.getTime() + 30 * 60_000),
      organizerEmail: item.organizer?.emailAddress?.address?.toLowerCase() ?? null,
      attendees: (item.attendees ?? [])
        .filter((attendee) => attendee.emailAddress?.address)
        .map((attendee) => ({
          email: attendee.emailAddress!.address!.toLowerCase(),
          name: attendee.emailAddress?.name ?? null,
        })),
      meetingUrl: item.onlineMeeting?.joinUrl ?? item.webLink ?? null,
    };
  });
}

export async function calendarAccountEmail(provider: CalendarProviderName, accessToken: string): Promise<string | null> {
  if (provider === "google") return googleAccountEmail(accessToken);
  const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { mail?: string; userPrincipalName?: string };
  return (body.mail ?? body.userPrincipalName ?? "").toLowerCase() || null;
}
