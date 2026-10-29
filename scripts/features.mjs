#!/usr/bin/env node
/**
 * Update one row of replica/features.csv without touching the CRLF endings.
 *
 * Usage:
 *   node scripts/features.mjs "Task list across all meetings" yes "S36: filters, grouping, bulk update, CSV export"
 */
import { readFileSync, writeFileSync } from "node:fs";

const [needle, clone, notes] = process.argv.slice(2);
if (!needle || !clone) {
  console.error("usage: node scripts/features.mjs <feature substring> <clone yes|partial|no|skip> [notes]");
  process.exit(1);
}

const path = new URL("../replica/features.csv", import.meta.url);
const raw = readFileSync(path, "utf8");
const lines = raw.split("\r\n");

let updated = 0;
for (let index = 1; index < lines.length; index += 1) {
  const line = lines[index];
  if (!line) continue;
  const cells = line.split(",");
  if (!cells[0] || !cells[0].toLowerCase().includes(needle.toLowerCase())) continue;
  cells[4] = clone;
  // Notes may contain commas, so everything from the sixth cell onwards is
  // replaced as one block.
  if (notes !== undefined) {
    cells.splice(5, cells.length - 5, notes);
  }
  lines[index] = cells.join(",");
  updated += 1;
}

if (!updated) {
  console.error(`no feature row matched "${needle}"`);
  process.exit(1);
}

writeFileSync(path, lines.join("\r\n"));
console.log(`updated ${updated} row(s) for "${needle}"`);
