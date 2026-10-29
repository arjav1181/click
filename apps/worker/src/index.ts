import "dotenv/config";
import { createServer } from "node:http";
import { pool } from "@click/db";
import { queueHealth, startWorkers } from "@click/backend";

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 8081);
const workers = startWorkers({ concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) });

const server = createServer(async (request, response) => {
  if (request.url !== "/healthz") {
    response.writeHead(404).end();
    return;
  }
  let database = false;
  try {
    await pool.query("select 1");
    database = true;
  } catch {
    database = false;
  }
  const queue = await queueHealth();
  const ok = database && queue.configured;
  response.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      ok,
      service: "click-worker",
      database,
      queue,
      time: new Date().toISOString(),
    }),
  );
});

server.listen(healthPort, () => {
  console.info(`[worker] listening on :${healthPort}, queues: transcribe, summarize, embed, email`);
});

const shutdown = async (signal: string) => {
  console.info(`[worker] ${signal}; finishing in-flight jobs`);
  server.close();
  await workers.close();
  await pool.end();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("[worker] unhandled rejection", error);
});
