import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { redisUrl } from "./env";
import { runJob, type JobPayload } from "./jobs";

export const QUEUES = ["transcribe", "summarize", "embed", "email"] as const;
export type QueueName = (typeof QUEUES)[number];

type DataFor<Q extends QueueName> = Q extends "transcribe"
  ? Extract<JobPayload, { name: "transcribe" }>["data"]
  : Q extends "summarize"
    ? Extract<JobPayload, { name: "summarize" }>["data"]
    : Q extends "embed"
      ? Extract<JobPayload, { name: "embed" }>["data"]
      : Extract<JobPayload, { name: "email" }>["data"];

let redis: IORedis | null = null;
let queues: Map<QueueName, Queue> | null = null;

export function isQueueConfigured() {
  return Boolean(redisUrl());
}

export function redisConnection(): IORedis {
  if (!redis) {
    redis = new IORedis(redisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    redis.on("error", (error) => console.error("[redis]", error.message));
  }
  return redis;
}

function queueFor(name: QueueName): Queue {
  if (!queues) queues = new Map();
  const existing = queues.get(name);
  if (existing) return existing;
  const created = new Queue(name, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
    },
  });
  queues.set(name, created);
  return created;
}

/**
 * Adds a job. With no Redis the job runs in the web process, which keeps
 * `docker compose up` with only Postgres honest for demos and tests. Production
 * installs set REDIS_URL and run apps/worker.
 */
export async function enqueue<Q extends QueueName>(name: Q, data: DataFor<Q>): Promise<string | null> {
  if (!isQueueConfigured()) {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[queue] REDIS_URL not set; running ${name} inline`);
    }
    const payload = { name, data } as JobPayload;
    const run = async () => {
      const result = await runJob(payload);
      await chain(payload, result.orgId, result.meetingId);
    };
    if (process.env.INLINE_QUEUE_SYNC === "1") {
      await run();
    } else {
      void run().catch((error) => console.error(`[queue] inline ${name} failed`, error));
    }
    return null;
  }
  const job = await queueFor(name).add(name, data);
  return job.id ?? null;
}

async function chain(payload: JobPayload, orgId: string, meetingId?: string) {
  if (!meetingId) return;
  if (payload.name === "transcribe") {
    await enqueue("summarize", { orgId, meetingId });
  } else if (payload.name === "summarize") {
    await enqueue("embed", { orgId, meetingId });
  }
}

export interface WorkerHandle {
  workers: Worker[];
  close: () => Promise<void>;
}

/** Starts one BullMQ worker per queue. Used by apps/worker. */
export function startWorkers(options: { concurrency?: number } = {}): WorkerHandle {
  if (!isQueueConfigured()) {
    throw new Error("REDIS_URL is required to start workers.");
  }
  const concurrency = options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? 2);
  const workers = QUEUES.map(
    (name) =>
      new Worker(
        name,
        async (job: Job) => {
          const payload = { name: job.name === name ? name : name, data: job.data } as JobPayload;
          const result = await runJob(payload);
          await chain(payload, result.orgId, result.meetingId);
          return { ok: true };
        },
        { connection: redisConnection(), concurrency },
      ),
  );
  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      console.error(`[worker] ${worker.name} job ${job?.id ?? "?"} failed:`, error.message);
    });
    worker.on("completed", (job) => {
      console.info(`[worker] ${worker.name} job ${job.id} completed`);
    });
  }
  return {
    workers,
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all([...(queues?.values() ?? [])].map((queue) => queue.close()));
      if (redis) await redis.quit();
    },
  };
}

export async function queueHealth(): Promise<{ configured: boolean; queues: Record<string, number> }> {
  if (!isQueueConfigured()) return { configured: false, queues: {} };
  const counts: Record<string, number> = {};
  for (const name of QUEUES) {
    try {
      counts[name] = await queueFor(name).getWaitingCount();
    } catch {
      counts[name] = -1;
    }
  }
  return { configured: true, queues: counts };
}

// --- rate limiting ---------------------------------------------------------

const memoryHits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Fixed-window limiter. Redis when available so limits hold across instances;
 * in-memory otherwise (single-process dev). Auth routes always call this.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  if (isQueueConfigured()) {
    const bucket = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    const count = await redisConnection().incr(bucket);
    if (count === 1) await redisConnection().pexpire(bucket, windowMs);
    const ttl = await redisConnection().pttl(bucket);
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt: now + Math.max(ttl, 0), limit };
  }

  const existing = memoryHits.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryHits.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }
  existing.count += 1;
  if (memoryHits.size > 10_000) {
    for (const [entry, value] of memoryHits) {
      if (value.resetAt <= now) memoryHits.delete(entry);
    }
  }
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    limit,
  };
}
