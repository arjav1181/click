import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BotJoinRequest, BotState } from "./types";

export interface CallbackResult {
  ok: boolean;
  error?: string;
}

function sign(raw: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

async function post(
  url: string,
  raw: Buffer,
  contentType: string,
  secret: string,
  timeoutMs: number,
): Promise<CallbackResult> {
  let lastError = "callback_failed";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(raw.length),
          "X-Click-Signature": `sha256=${sign(raw, secret)}`,
          "X-Click-Timestamp": String(Date.now()),
        },
        body: Uint8Array.from(raw).buffer,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return { ok: true };
      lastError = `callback_${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`;
    } catch (error) {
      lastError = `callback_unreachable: ${error instanceof Error ? error.message : "unknown"}`;
    }
  }
  return { ok: false, error: lastError };
}

export async function postLifecycle(
  job: BotJoinRequest,
  state: BotState,
  detail: string | null,
  secret: string,
  timeoutMs: number,
): Promise<CallbackResult> {
  const raw = Buffer.from(JSON.stringify({ state, detail }));
  return post(`${job.callbackBaseUrl}/${job.botJobId}/lifecycle`, raw, "application/json", secret, timeoutMs);
}

/**
 * The recording route expects multipart/form-data. Playwright's audio tap
 * produces a WAV, so the upload is a single file field named `file`.
 */
export async function uploadRecording(
  job: BotJoinRequest,
  wavPath: string,
  secret: string,
  timeoutMs: number,
): Promise<CallbackResult> {
  const audio = await readFile(wavPath);
  if (audio.length <= 44) return { ok: false, error: "recording_empty" };
  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(audio)], { type: "audio/wav" }), "meeting.wav");
  const request = new Request("http://callback.local/", { method: "POST", body: form });
  const raw = Buffer.from(await request.arrayBuffer());
  const contentType = request.headers.get("content-type") ?? "multipart/form-data";
  return post(`${job.callbackBaseUrl}/${job.botJobId}/recording`, raw, contentType, secret, Math.max(timeoutMs, 120_000));
}
