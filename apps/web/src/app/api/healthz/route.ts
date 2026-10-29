import { pool } from "@click/db";
import { isMailConfigured, isQueueConfigured, storageConfig } from "@click/backend";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  let database = "down";
  try {
    await pool.query("select 1");
    database = "up";
  } catch {
    database = "down";
  }
  const body = {
    ok: database === "up",
    service: "click-web",
    version: process.env.CLICK_VERSION ?? "dev",
    database,
    queue: isQueueConfigured() ? "redis" : "inline",
    storage: storageConfig().driver,
    email: isMailConfigured() ? "smtp" : "off",
    time: new Date().toISOString(),
  };
  return json(body, { status: body.ok ? 200 : 503 });
});
