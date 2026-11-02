import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { sendJson, parseJson, readRawBody, verifySignature } from "./http";
import { BotManager } from "./manager";
import { parseJoinRequest, isBotProvider } from "./types";

const MAX_SKEW_MS = 5 * 60_000;

function freshTimestamp(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  const raw = request.headers["x-click-timestamp"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(Date.now() - parsed) <= MAX_SKEW_MS;
}

const config = loadConfig();
if (!config.serviceSecret) {
  console.error("[bot] BOT_SERVICE_SECRET or BOT_WEBHOOK_SECRET is required.");
  process.exit(1);
}
if (!config.browserExecutable) {
  console.error(
    "[bot] No Chromium found. Set BOT_CHROMIUM_PATH or install Playwright's Chromium (pnpm exec playwright install chromium).",
  );
  process.exit(1);
}

await mkdir(config.artifactsDir, { recursive: true });
const manager = new BotManager(config);
await manager.load();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://bot.local");

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, {
      ok: true,
      service: "click-bot",
      browser: config.browserExecutable,
      headless: config.headless,
      ...manager.status(),
      time: new Date().toISOString(),
    });
    return;
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/v1/join" ||
      url.pathname.endsWith("/stop") ||
      url.pathname.endsWith("/reset"))
  ) {
    let raw: Buffer;
    try {
      raw = await readRawBody(request);
    } catch {
      sendJson(response, 413, { error: "payload_too_large" });
      return;
    }
    if (!verifySignature(raw, request.headers["x-click-signature"] as string ?? "", config.serviceSecret)) {
      sendJson(response, 401, { error: "bad_signature" });
      return;
    }
    if (!freshTimestamp(request)) {
      sendJson(response, 401, { error: "stale_signature" });
      return;
    }

    if (url.pathname === "/v1/join") {
      const parsed = parseJoinRequest(parseJson(raw));
      if ("error" in parsed) {
        sendJson(response, 422, { error: parsed.error });
        return;
      }
      const result = manager.submit(parsed.request);
      if (!result.accepted) {
        sendJson(response, result.error === "provider_circuit_open" ? 503 : 429, { error: result.error });
        return;
      }
      sendJson(response, 202, { accepted: true, state: "queued" });
      return;
    }

    const match = url.pathname.match(/^\/v1\/bots\/([^/]+)\/stop$/);
    if (match) {
      const stopped = manager.stop(decodeURIComponent(match[1]));
      sendJson(response, stopped ? 202 : 404, { stopped });
      return;
    }

    const resetMatch = url.pathname.match(/^\/v1\/providers\/([^/]+)\/reset$/);
    if (resetMatch) {
      const provider = decodeURIComponent(resetMatch[1]);
      if (!isBotProvider(provider)) {
        sendJson(response, 422, { error: "unknown_provider" });
        return;
      }
      manager.resetCircuit(provider);
      sendJson(response, 200, { ok: true, provider });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  }

  sendJson(response, 404, { error: "not_found" });
});

server.listen(config.port, "0.0.0.0", () => {
  console.info(`[bot] listening on :${config.port} (headless=${config.headless}, chromium=${config.browserExecutable})`);
  const status = manager.status();
  for (const [provider, health] of Object.entries(status.providers)) {
    if (health.open) console.warn(`[bot] provider ${provider} is circuit-open after ${health.failures} failures`);
  }
});

const shutdown = async (signal: string) => {
  console.info(`[bot] ${signal}; stopping sessions`);
  server.close();
  await manager.shutdown();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("[bot] unhandled rejection", error);
});
