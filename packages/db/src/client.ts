import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema";

export interface TenantContext {
  orgId: string;
  userId: string;
}

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "click-web",
});

pool.on("error", (error) => {
  console.error("[db] idle client error", error.message);
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export type Tx = NodePgDatabase<typeof schema>;

/**
 * Runs `fn` inside a transaction with the tenant settings RLS depends on.
 * Every tenant-scoped repository call goes through this function; there is no
 * other way to get a `Tx` in application code.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // RLS only applies to roles that do not own the tables and do not have
    // BYPASSRLS, so tenant queries are executed as click_app.
    await tx.execute(sql`set local role click_app`);
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId}, true)`);
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`);
    return fn(tx as unknown as Tx);
  });
}

/**
 * Auth transactions run as `click_auth` (bypassrls) because login happens
 * before a tenant exists. Scoped down with SET LOCAL ROLE inside the tx.
 */
export async function withAuth<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role click_auth");
    const tx = drizzle(client, { schema }) as unknown as Tx;
    const result = await fn(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function isDatabaseConfigured() {
  return Boolean(connectionString);
}
