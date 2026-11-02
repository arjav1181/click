import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { BotConfig } from "./config";
import { postLifecycle, uploadRecording } from "./callbacks";
import { joinMeeting } from "./join";
import type { BotJoinRequest, BotState } from "./types";
import { WavWriter } from "./wav";

const ENDED_TEXT = [
  "You left the meeting",
  "The meeting has ended",
  "The call has ended",
  "Return to home screen",
  "You've been removed",
];

function logLine(job: BotJoinRequest, message: string): void {
  console.info(`[bot ${job.botJobId.slice(0, 8)}] ${message}`);
}

export interface SessionEvents {
  onStarted: () => void;
  onFinished: (failed: boolean, admitted: boolean, failureCode: string | null) => void;
}

export class BotSession {
  private readonly abort = new AbortController();
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private writer: WavWriter | null = null;
  private stopReason: string | null = null;
  private sessionFailed = false;
  private failureCode: string | null = null;
  private finished = false;

  constructor(
    private readonly job: BotJoinRequest,
    private readonly config: BotConfig,
    private readonly events: SessionEvents,
  ) {}

  stop(reason = "stopped_by_operator"): void {
    if (this.stopReason) return;
    this.stopReason = reason;
    this.abort.abort();
  }

  private async lifecycle(state: BotState, detail: string | null = null): Promise<void> {
    const result = await postLifecycle(
      this.job,
      state,
      detail,
      this.config.serviceSecret,
      this.config.callbackTimeoutMs,
    );
    if (!result.ok) logLine(this.job, `lifecycle ${state} callback failed: ${result.error}`);
  }

  private async failureArtifacts(dir: string): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.screenshot({ path: join(dir, "failure.png"), timeout: 5_000 });
    } catch {
      /* a closed page has nothing to save */
    }
    try {
      await writeFile(join(dir, "failure.html"), await this.page.content(), "utf8");
    } catch {
      /* best effort */
    }
  }

  async run(): Promise<void> {
    const dir = join(this.config.artifactsDir, this.job.botJobId);
    await mkdir(dir, { recursive: true });
    const wavPath = join(dir, "meeting.wav");
    this.writer = new WavWriter(wavPath);
    this.events.onStarted();

    let admitted = false;
    try {
      await this.lifecycle("joining");
      await this.writer.open();

      if (!this.config.browserExecutable && !this.config.headless && !process.env.DISPLAY) {
        await this.fail(dir, "no_display_configured", "Headed mode needs DISPLAY or Xvfb.");
        return;
      }

      this.browser = await chromium.launch({
        executablePath: this.config.browserExecutable ?? undefined,
        headless: this.config.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-infobars",
          "--autoplay-policy=no-user-gesture-required",
          "--use-fake-ui-for-media-stream",
          "--use-fake-device-for-media-stream",
          `--lang=${this.config.locale}`,
          `--accept-lang=${this.config.locale}`,
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });
      this.context = await this.browser.newContext({
        locale: this.config.locale,
        timezoneId: this.config.timezone,
        viewport: { width: 1280, height: 800 },
        permissions: ["microphone", "camera"],
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
      });
      this.page = await this.context.newPage();

      await this.page.exposeBinding("__clickTapLog", (_source, message: string) => {
        logLine(this.job, String(message).slice(0, 300));
      });
      await this.page.exposeBinding("__clickAudioChunk", async (_source, base64: string) => {
        if (!this.writer || typeof base64 !== "string") return;
        try {
          await this.writer.append(Buffer.from(base64, "base64"));
        } catch (error) {
          logLine(this.job, `audio append failed: ${error instanceof Error ? error.message : "unknown"}`);
        }
      });
      await this.page.addInitScript({ path: fileURLToPath(new URL("./page/stealth.js", import.meta.url)) });
      await this.page.addInitScript({ path: fileURLToPath(new URL("./page/audio-tap.js", import.meta.url)) });

      const result = await joinMeeting(this.page, this.job, {
        log: (message) => logLine(this.job, message),
        onLobby: async (detail) => {
          await this.lifecycle("lobby", detail);
        },
        signal: this.abort.signal,
        lobbyTimeoutMs: this.config.lobbyTimeoutMs,
      });

      if (!result.admitted) {
        const reason = result.reason ?? "join_failed";
        if (reason === "stopped") {
          await this.lifecycle("cancelled", "Stopped before admission.");
          return;
        }
        await this.failureArtifacts(dir);
        await this.fail(dir, reason, result.detail ?? null);
        return;
      }

      admitted = true;
      await this.lifecycle("active");
      await this.page.evaluate(async () => {
        const tap = (window as unknown as { __clickStartTap?: () => Promise<unknown> }).__clickStartTap;
        if (tap) await tap();
      });

      await this.recordUntilDone();
      await this.finishRecording();
    } catch (error) {
      if (this.stopReason) {
        if (admitted) {
          await this.finishRecording();
        } else {
          await this.lifecycle("cancelled", "Stopped before admission.");
        }
        return;
      }
      const message = error instanceof Error ? error.message : "unknown error";
      logLine(this.job, `session failed: ${message}`);
      await this.failureArtifacts(dir);
      await this.fail(dir, "browser_session_failed", message.slice(0, 200));
    } finally {
      await this.cleanup();
      this.events.onFinished(this.sessionFailed, admitted, this.failureCode);
    }
  }

  private async fail(dir: string, code: string, detail: string | null): Promise<void> {
    this.sessionFailed = true;
    this.failureCode = code;
    logLine(this.job, `failed: ${code}${detail ? ` (${detail})` : ""}`);
    await this.lifecycle("failed", detail ? `${code}: ${detail}`.slice(0, 1000) : code);
    await this.failureArtifacts(dir);
  }

  private async recordUntilDone(): Promise<void> {
    const startedAt = Date.now();
    let lastAudioAt = Date.now();
    let sawAudio = false;

    while (!this.abort.signal.aborted) {
      if (!this.page || this.page.isClosed()) {
        throw new Error("page_closed");
      }
      if (Date.now() - startedAt > this.config.maxDurationMs) {
        logLine(this.job, "duration cap reached");
        break;
      }

      const stats = await this.page
        .evaluate(() => {
          const tap = (window as unknown as { __clickTapStats?: { lastAudioAt?: number; bytes?: number } })
            .__clickTapStats;
          return { lastAudioAt: tap?.lastAudioAt ?? 0, bytes: tap?.bytes ?? 0 };
        })
        .catch(() => ({ lastAudioAt: 0, bytes: 0 }));

      if (stats.bytes > 0) {
        sawAudio = true;
        if (stats.lastAudioAt > 0) lastAudioAt = stats.lastAudioAt;
      }
      if (sawAudio && Date.now() - lastAudioAt > this.config.silenceTimeoutMs) {
        logLine(this.job, "no remote audio for the silence window; leaving");
        break;
      }

      const text = await this.page
        .locator("body")
        .innerText({ timeout: 3_000 })
        .catch(() => "");
      if (ENDED_TEXT.some((needle) => text.toLowerCase().includes(needle.toLowerCase()))) {
        logLine(this.job, "meeting ended");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  private async finishRecording(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    if (!this.page || this.page.isClosed()) {
      await this.writer?.finalize();
      return;
    }
    try {
      await this.page.evaluate(async () => {
        const stop = (window as unknown as { __clickStopTap?: () => Promise<unknown> }).__clickStopTap;
        if (stop) await stop();
      });
    } catch {
      /* page may already be gone */
    }
    await this.writer?.finalize();
    const bytes = this.writer?.bytes ?? 0;
    if (bytes <= 44) {
      this.sessionFailed = true;
      await this.fail(
        join(this.config.artifactsDir, this.job.botJobId),
        "no_audio_captured",
        "The bot was admitted but no remote audio reached the tap.",
      );
      return;
    }

    const result = await uploadRecording(
      this.job,
      this.writer!.path,
      this.config.serviceSecret,
      this.config.callbackTimeoutMs,
    );
    if (!result.ok) {
      this.sessionFailed = true;
      await this.fail(join(this.config.artifactsDir, this.job.botJobId), "recording_upload_failed", result.error ?? null);
      return;
    }
    await this.lifecycle("completed", `recording_uploaded:${Math.round(this.writer!.durationSeconds)}s`);
  }

  private async cleanup(): Promise<void> {
    await this.writer?.finalize().catch(() => {});
    await this.page?.close().catch(() => {});
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
