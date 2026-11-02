export type BotProvider = "meet" | "jitsi" | "zoom" | "teams" | "webex";

export const BOT_PROVIDERS: BotProvider[] = ["meet", "jitsi", "zoom", "teams", "webex"];

export type BotState = "queued" | "joining" | "lobby" | "active" | "completed" | "failed" | "cancelled";

/** The body the web app signs and posts to `/v1/join`. */
export interface BotJoinRequest {
  botJobId: string;
  orgId: string;
  meetingId: string;
  provider: BotProvider;
  meetingUrl: string;
  botName: string;
  consentNotice: string;
  callbackBaseUrl: string;
  passcode?: string | null;
}

const PROVIDER_HOSTS: Record<BotProvider, string[]> = {
  meet: ["meet.google.com"],
  jitsi: ["meet.jit.si"],
  zoom: ["zoom.us", "zoomgov.com"],
  teams: ["teams.microsoft.com", "teams.live.com"],
  webex: ["webex.com"],
};

export function isBotProvider(value: unknown): value is BotProvider {
  return typeof value === "string" && (BOT_PROVIDERS as string[]).includes(value);
}

export function hostMatchesProvider(provider: BotProvider, url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return PROVIDER_HOSTS[provider].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= max ? clean : null;
}

/** Validates an untrusted join body and returns a readable error instead of throwing. */
export function parseJoinRequest(body: unknown): { request: BotJoinRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const raw = body as Record<string, unknown>;
  const botJobId = text(raw.botJobId, 100);
  const orgId = text(raw.orgId, 100);
  const meetingId = text(raw.meetingId, 100);
  const meetingUrl = text(raw.meetingUrl, 2000);
  const botName = text(raw.botName, 80);
  const consentNotice = text(raw.consentNotice, 2000);
  const callbackBaseUrl = text(raw.callbackBaseUrl, 2000);
  const passcode = raw.passcode == null ? null : text(raw.passcode, 200);

  if (!botJobId || !orgId || !meetingId || !meetingUrl || !botName || !consentNotice || !callbackBaseUrl) {
    return { error: "one or more required fields are missing" };
  }
  if (!isBotProvider(raw.provider)) return { error: "unknown provider" };
  if (!hostMatchesProvider(raw.provider, meetingUrl)) {
    return { error: `meetingUrl does not look like a ${raw.provider} meeting` };
  }
  if (!/^https?:\/\//i.test(callbackBaseUrl)) return { error: "callbackBaseUrl must be absolute" };

  return {
    request: {
      botJobId,
      orgId,
      meetingId,
      provider: raw.provider,
      meetingUrl,
      botName,
      consentNotice,
      callbackBaseUrl: callbackBaseUrl.replace(/\/$/, ""),
      passcode,
    },
  };
}
