/**
 * Client for the bot service (`apps/bot`).
 *
 * The web app never talks to Zoom, Meet, Teams or Webex directly: it asks the
 * bot service to join a meeting, and the bot service reports back through the
 * HMAC-signed callbacks in `/internal/v1/bots/[id]/*`.
 */
import { createHmac } from "node:crypto";
import { appUrl } from "./env";

export interface BotJoinRequest {
  botJobId: string;
  meetingId: string;
  provider: string;
  meetingUrl: string;
  botName: string;
  consentNotice: string;
  callbackBaseUrl: string;
}

export interface BotJoinResult {
  ok: boolean;
  error?: string;
}

export function botServiceUrl(): string {
  return (process.env.BOT_SERVICE_URL ?? "").replace(/\/$/, "");
}

export function isBotServiceConfigured(): boolean {
  return Boolean(botServiceUrl());
}

function sign(body: string): string {
  const secret = process.env.BOT_SERVICE_SECRET ?? process.env.BOT_WEBHOOK_SECRET ?? "";
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function requestBotJoin(request: BotJoinRequest): Promise<BotJoinResult> {
  const base = botServiceUrl();
  if (!base) {
    return { ok: false, error: "bot_service_not_configured" };
  }
  const body = JSON.stringify(request);
  try {
    const response = await fetch(`${base}/v1/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Click-Signature": sign(body),
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `bot_service_error_${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `bot_service_unreachable: ${error instanceof Error ? error.message : "unknown"}` };
  }
}

export function callbackBaseUrl(): string {
  return `${appUrl()}/internal/v1/bots`;
}
