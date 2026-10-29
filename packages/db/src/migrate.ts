#!/usr/bin/env node
import "./load-env";
/**
 * Applies SQL migrations in packages/db/migrations in filename order.
 * Usage: DATABASE_URL=... pnpm --filter @click/db migrate
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
// MIGRATIONS_DIR lets CI and local dev apply a patched copy (for example one
// without pgvector) without touching the canonical migrations.
const migrationsDir = process.env.MIGRATIONS_DIR
  ? resolve(process.env.MIGRATIONS_DIR)
  : join(here, "../migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, application_name: "click-migrate" });
await client.connect();

await client.query(`
  create table if not exists schema_migrations (
    name       text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  )
`);

const applied = new Map<string, string>();
const existing = await client.query<{ name: string; checksum: string }>(
  "select name, checksum from schema_migrations",
);
for (const row of existing.rows) applied.set(row.name, row.checksum);

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

let ran = 0;
for (const file of files) {
  const sql = await readFile(join(migrationsDir, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const previous = applied.get(file);
  if (previous) {
    if (previous !== checksum) {
      console.error(
        `!! ${file} changed after it was applied. Add a new migration instead of editing history.`,
      );
      process.exit(1);
    }
    continue;
  }

  console.log(`-> ${file}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into schema_migrations (name, checksum) values ($1,$2)", [
      file,
      checksum,
    ]);
    await client.query("commit");
    ran += 1;
  } catch (error) {
    await client.query("rollback");
    console.error(`!! ${file} failed:`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

console.log(ran === 0 ? "database is up to date" : `applied ${ran} migration(s)`);
await client.end();
