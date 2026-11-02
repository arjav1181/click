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
  orgId: string;
  meetingId: string;
  provider: string;
  meetingUrl: string;
  botName: string;
  consentNotice: string;
  callbackBaseUrl: string;
  passcode?: string | null;
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

function secret(): string {
  return process.env.BOT_SERVICE_SECRET ?? process.env.BOT_WEBHOOK_SECRET ?? "";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

async function post(path: string, body: string): Promise<BotJoinResult> {
  const base = botServiceUrl();
  if (!base) {
    return { ok: false, error: "bot_service_not_configured" };
  }
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Click-Signature": `sha256=${sign(body)}`,
        "X-Click-Timestamp": String(Date.now()),
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

export async function requestBotJoin(request: BotJoinRequest): Promise<BotJoinResult> {
  return post("/v1/join", JSON.stringify(request));
}

/** Asks the runner to leave early; it still uploads whatever audio it captured. */
export async function requestBotStop(botJobId: string): Promise<BotJoinResult> {
  return post(`/v1/bots/${encodeURIComponent(botJobId)}/stop`, JSON.stringify({ botJobId }));
}

/** Clears the provider circuit breaker after an operator fixed the cause. */
export async function requestBotCircuitReset(provider: string): Promise<BotJoinResult> {
  return post(`/v1/providers/${encodeURIComponent(provider)}/reset`, JSON.stringify({ provider }));
}

export interface BotRunnerHealth {
  active: number;
  queued: number;
  maxConcurrent: number;
  providers: Record<string, { failures: number; open: boolean }>;
}

/** Reads the runner's health so the admin UI can show real provider state. */
export async function fetchBotRunnerStatus(): Promise<{
  ok: boolean;
  configured: boolean;
  status: BotRunnerHealth | null;
  error?: string;
}> {
  const base = botServiceUrl();
  if (!base) return { ok: false, configured: false, status: null };
  try {
    const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return { ok: false, configured: true, status: null, error: `status_${response.status}` };
    return { ok: true, configured: true, status: (await response.json()) as BotRunnerHealth };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: null,
      error: `bot_service_unreachable: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

export function callbackBaseUrl(): string {
  return `${appUrl()}/internal/v1/bots`;
}
