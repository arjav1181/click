import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

/**
 * Bot runner configuration. Everything is optional except the shared secret:
 * the service refuses to start without one so a callback can never be forged.
 */
export interface BotConfig {
  port: number;
  serviceSecret: string;
  callbackTimeoutMs: number;
  maxConcurrent: number;
  maxDurationMs: number;
  lobbyTimeoutMs: number;
  silenceTimeoutMs: number;
  failureThreshold: number;
  headless: boolean;
  locale: string;
  timezone: string;
  artifactsDir: string;
  stateFile: string;
  browserExecutable: string | null;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Prefer an explicit path, then Playwright's own registry, then a system
 * Chromium. Returning null lets Playwright produce its own clear launch error.
 */
function findBrowserExecutable(): string | null {
  const explicit = process.env.BOT_CHROMIUM_PATH?.trim();
  if (explicit) return explicit;

  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return bundled;

  for (const candidate of [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/repl/tools/bin/chromium",
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function loadConfig(): BotConfig {
  return {
    port: int(process.env.BOT_PORT, 8090),
    serviceSecret: process.env.BOT_SERVICE_SECRET ?? process.env.BOT_WEBHOOK_SECRET ?? "",
    callbackTimeoutMs: int(process.env.BOT_CALLBACK_TIMEOUT_MS, 20_000),
    maxConcurrent: Math.max(1, int(process.env.BOT_MAX_CONCURRENT, 2)),
    maxDurationMs: Math.max(1, int(process.env.BOT_MAX_DURATION_MINUTES, 240)) * 60_000,
    lobbyTimeoutMs: Math.max(1, int(process.env.BOT_LOBBY_TIMEOUT_MINUTES, 10)) * 60_000,
    silenceTimeoutMs: Math.max(1, int(process.env.BOT_SILENCE_TIMEOUT_MINUTES, 5)) * 60_000,
    failureThreshold: Math.max(0, int(process.env.BOT_FAILURE_THRESHOLD, 3)),
    headless: bool(process.env.BOT_HEADLESS, true),
    locale: process.env.BOT_UI_LOCALE ?? "en-US",
    timezone: process.env.BOT_TIMEZONE ?? "UTC",
    artifactsDir: resolve(process.env.BOT_ARTIFACTS_DIR ?? ".data/bot"),
    stateFile: resolve(process.env.BOT_STATE_FILE ?? ".data/bot/circuit-breaker.json"),
    browserExecutable: findBrowserExecutable(),
  };
}
