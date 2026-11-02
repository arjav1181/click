import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BotConfig } from "./config";
import { postLifecycle } from "./callbacks";
import { BotSession } from "./session";
import type { BotJoinRequest, BotProvider } from "./types";

interface PersistedState {
  failures: Partial<Record<BotProvider, number>>;
}

export interface BotManagerStatus {
  active: number;
  queued: number;
  maxConcurrent: number;
  providers: Record<string, { failures: number; open: boolean }>;
}

/**
 * Only technical failures trip the breaker. A host denying the bot or a
 * provider without an adapter is a normal outcome, not a defect.
 */
const TECHNICAL_FAILURES = new Set([
  "browser_session_failed",
  "join_failed",
  "no_audio_captured",
  "join_page_unexpected",
]);

/**
 * Owns the join queue and the provider circuit breaker. A provider is disabled
 * after `BOT_FAILURE_THRESHOLD` consecutive technical join failures, so a
 * broken Meet layout does not burn through the whole queue.
 */
export class BotManager {
  private readonly queue: BotJoinRequest[] = [];
  private readonly active = new Map<string, BotSession>();
  private readonly failures = new Map<BotProvider, number>();

  constructor(private readonly config: BotConfig) {}

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.config.stateFile, "utf8")) as PersistedState;
      for (const [provider, count] of Object.entries(raw.failures ?? {})) {
        if (typeof count === "number" && count > 0) this.failures.set(provider as BotProvider, count);
      }
    } catch {
      /* first run, or a corrupt file: start clean */
    }
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.config.stateFile), { recursive: true });
      await writeFile(
        this.config.stateFile,
        JSON.stringify({ failures: Object.fromEntries(this.failures) }, null, 2),
        "utf8",
      );
    } catch (error) {
      console.error("[bot] could not persist circuit state", error);
    }
  }

  private isOpen(provider: BotProvider): boolean {
    return (this.failures.get(provider) ?? 0) >= this.config.failureThreshold;
  }

  submit(request: BotJoinRequest): { accepted: boolean; error?: string } {
    if (this.active.has(request.botJobId) || this.queue.some((job) => job.botJobId === request.botJobId)) {
      return { accepted: true };
    }
    if (this.isOpen(request.provider)) {
      return { accepted: false, error: "provider_circuit_open" };
    }
    if (this.queue.length >= 100) return { accepted: false, error: "bot_queue_full" };
    this.queue.push(request);
    this.pump();
    return { accepted: true };
  }

  stop(botJobId: string): boolean {
    const active = this.active.get(botJobId);
    if (active) {
      active.stop();
      return true;
    }
    const index = this.queue.findIndex((job) => job.botJobId === botJobId);
    if (index >= 0) {
      const [job] = this.queue.splice(index, 1);
      void postLifecycle(job, "cancelled", "Stopped before the browser started.", this.config.serviceSecret, this.config.callbackTimeoutMs);
      return true;
    }
    return false;
  }

  /** Operator action: clear the circuit so a fixed provider can be used again. */
  resetCircuit(provider: BotProvider): void {
    this.failures.delete(provider);
    void this.persist();
  }

  status(): BotManagerStatus {
    const providers: BotManagerStatus["providers"] = {};
    for (const provider of ["meet", "jitsi", "zoom", "teams", "webex"] as BotProvider[]) {
      const failures = this.failures.get(provider) ?? 0;
      providers[provider] = { failures, open: this.isOpen(provider) };
    }
    return {
      active: this.active.size,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      providers,
    };
  }

  private pump(): void {
    while (this.active.size < this.config.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift()!;
      const session = new BotSession(job, this.config, {
        onStarted: () => {},
        onFinished: (failed, admitted, failureCode) => {
          this.active.delete(job.botJobId);
          if (failed && !admitted && failureCode && TECHNICAL_FAILURES.has(failureCode)) {
            this.failures.set(job.provider, (this.failures.get(job.provider) ?? 0) + 1);
            void this.persist();
          } else if (admitted) {
            this.failures.set(job.provider, 0);
            void this.persist();
          }
          this.pump();
        },
      });
      this.active.set(job.botJobId, session);
      void session.run().catch((error) => {
        console.error(`[bot] session ${job.botJobId} crashed`, error);
      });
    }
  }

  async shutdown(): Promise<void> {
    for (const session of this.active.values()) session.stop("shutdown");
    this.queue.length = 0;
    const deadline = Date.now() + 15_000;
    while (this.active.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
