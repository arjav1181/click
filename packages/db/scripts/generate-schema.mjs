#!/usr/bin/env node
// Generates a Drizzle table map from the canonical SQL in replica/schema.sql.
// The SQL remains the source of truth (and the migration); this file exists so
// query code is typed. Regenerate with `pnpm --filter @click/db schema`.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sql = fs.readFileSync(path.join(root, "../../replica/schema.sql"), "utf8");

const blocks = [...sql.matchAll(/create table (\w+) \(([\s\S]*?)\n\);/g)];

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const seen = new Set();

const typeMap = (raw) => {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("uuid[]")) return "uuid[]";
  if (t.startsWith("uuid")) return "uuid";
  if (t.startsWith("citext")) return "text";
  if (t.startsWith("text[]")) return "text[]";
  if (t.startsWith("text")) return "text";
  if (t.startsWith("timestamptz")) return "timestamp";
  if (t.startsWith("timestamp")) return "timestamp";
  if (t.startsWith("bigint")) return "bigint";
  if (t.startsWith("integer") || t === "int") return "integer";
  if (t.startsWith("numeric")) return "numeric";
  if (t.startsWith("boolean")) return "boolean";
  if (t.startsWith("jsonb")) return "jsonb";
  if (t.startsWith("inet")) return "inet";
  if (t.startsWith("vector")) return "vector";
  if (t.startsWith("tsvector")) return "tsvector";
  return "text";
};

const defaults = (raw, type) => {
  if (!raw) return null;
  const v = raw.trim();
  if (v === "now()") return ".defaultNow()";
  if (v === "true" || v === "false") return `.default(${v})`;
  const s = v.match(/^'([^']*)'$/);
  if (s) {
    const value = s[1];
    if (type === "text[]" || type === "uuid[]") {
      return value === "{}" ? ".default([])" : `.default(${JSON.stringify(value.split(","))})`;
    }
    if (type === "numeric") return `.default(${JSON.stringify(value)})`;
    return `.default(${JSON.stringify(value)})`;
  }
  const cast = v.match(/^'([^']*)'::\w+(?:\[\])?$/);
  if (cast) {
    if (type === "text[]" || type === "uuid[]") {
      const value = cast[1];
      return value === "{}" ? ".default([])" : `.default(${JSON.stringify(value.split(","))})`;
    }
    return `.default(${JSON.stringify(cast[1])})`;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(v)) {
    return type === "numeric" ? `.default(${JSON.stringify(v)})` : `.default(${v})`;
  }
  if (v.startsWith("gen_random_uuid()")) return ".defaultRandom()";
  return null;
};

let out = `// Generated from replica/schema.sql by packages/db/scripts/generate-schema.mjs.
// Do not hand-edit table shapes: change the SQL, then regenerate.
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  numeric,
  inet,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
});
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

`;

for (const [, table, body] of blocks) {
  seen.add(table);
  const lines = body.split("\n").map((l) => l.trim().replace(/,$/, "")).filter(Boolean);
  const cols = [];
  for (const line of lines) {
    if (/^(unique|constraint|primary key|check|foreign)\b/.test(line)) continue;
    const m = line.match(/^(\w+)\s+([a-zA-Z_]+(?:\([^)]*\))?(?:\[\])?)(.*)$/);
    if (!m) continue;
    const [, name, rawType, rest] = m;
    const t = typeMap(rawType);
    let chain = "";
    if (t === "uuid") chain = "uuid";
    else if (t === "text") chain = "text";
    else if (t === "text[]") chain = "text().array()";
    else if (t === "uuid[]") chain = "uuid().array()";
    else if (t === "timestamp") chain = "timestamp({ withTimezone: true })";
    else if (t === "integer") chain = "integer";
    else if (t === "bigint") chain = "bigint({ mode: 'number' })";
    else if (t === "numeric") chain = "numeric";
    else if (t === "boolean") chain = "boolean";
    else if (t === "jsonb") chain = "jsonb";
    else if (t === "inet") chain = "inet";
    else if (t === "vector") chain = "vector";
    else if (t === "tsvector") chain = "tsvector";
    else chain = "text";

    const qname = JSON.stringify(name);
    let decl;
    if (chain === "text().array()") decl = `  ${camel(name)}: text(${qname}).array()`;
    else if (chain === "uuid().array()") decl = `  ${camel(name)}: uuid(${qname}).array()`;
    else if (chain === "timestamp({ withTimezone: true })")
      decl = `  ${camel(name)}: timestamp(${qname}, { withTimezone: true })`;
    else if (chain === "bigint({ mode: 'number' })")
      decl = `  ${camel(name)}: bigint(${qname}, { mode: 'number' })`;
    else decl = `  ${camel(name)}: ${chain}(${qname})`;
    if (rawType.toLowerCase() === "uuid" && /primary key/i.test(rest)) decl += ".primaryKey()";
    if (/primary key/i.test(rest) && rawType.toLowerCase() !== "uuid") decl += ".primaryKey()";
    if (/not null/i.test(rest)) decl += ".notNull()";
    const def = defaults(
      rest.match(/default\s+(.+?)(?:\s+(?:not null|check|references|unique|generated))?$/i)?.[1],
      t,
    );
    if (def) decl += def;
    cols.push(decl);
  }
  out += `export const ${camel(table)} = pgTable(${JSON.stringify(table)}, {\n${cols.join(",\n")}\n});\n\n`;
}

fs.writeFileSync(path.join(root, "src/schema.ts"), out);
console.log("tables:", seen.size, "bytes:", out.length);
