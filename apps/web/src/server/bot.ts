import { createHmac, timingSafeEqual } from "node:crypto";
import { botWebhookSecret, isProduction } from "@click/backend";
import { ApiError } from "./http";

/**
 * Bot callbacks are signed over the exact raw body. A per-bot token in the URL
 * identifies the job; the HMAC proves the bot runner sent it.
 */
export async function readVerifiedBody(request: Request): Promise<{ raw: Buffer; body: unknown }> {
  const secret = botWebhookSecret();
  if (!secret) {
    throw new ApiError(503, "bot_not_configured", "BOT_WEBHOOK_SECRET is not configured on this instance.");
  }
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1_000_000) throw new ApiError(413, "payload_too_large", "Bot payloads are limited to 1 MB.");

  const header = request.headers.get("x-click-signature") ?? "";
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ApiError(401, "bad_signature", "The bot signature is invalid.");
  }

  const timestamp = request.headers.get("x-click-timestamp");
  if (isProduction() && timestamp) {
    const age = Math.abs(Date.now() - Number(timestamp));
    if (!Number.isFinite(age) || age > 5 * 60_000) {
      throw new ApiError(401, "stale_signature", "The bot signature has expired.");
    }
  }

  let body: unknown = null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new ApiError(400, "invalid_json", "The bot payload is not valid JSON.");
    }
  }
  return { raw, body };
}
