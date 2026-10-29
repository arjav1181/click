#!/usr/bin/env node
/**
 * Re-capture every clone screenshot after a CSS or layout change.
 *
 * Usage: node scripts/capture-all.mjs [--only S53,S58]
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const shots = [
  { id: "S01", route: "/login", mobile: false },
  { id: "S02", route: "/signup", mobile: false },
  { id: "S04", route: "/onboarding", mobile: false },
  { id: "S07", route: "/app", mobile: true },
  { id: "S08", route: "/app/meetings", mobile: true },
  { id: "S10", route: "/app/meetings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mobile: true },
  { id: "S26", route: "/app/channels", mobile: true },
  { id: "S27", route: "/app/folders", mobile: true },
  { id: "S36", route: "/app/tasks", mobile: true },
  { id: "S41", route: "/app/search", mobile: false },
  { id: "S42", route: "/app/import", mobile: false },
  { id: "S47", route: "/settings", mobile: false },
  { id: "S53", route: "/admin/members", mobile: true },
  { id: "S56", route: "/admin/ai", mobile: false },
  { id: "S58", route: "/admin/audit", mobile: true },
];

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;

for (const shot of shots) {
  if (only && !only.has(shot.id)) continue;
  const out = resolve(`replica/clone-screens/${shot.id}.png`);
  execFileSync("node", ["scripts/capture.mjs", "--route", shot.route, "--out", out], {
    stdio: "inherit",
  });
  if (shot.mobile) {
    const mobileOut = resolve(`replica/clone-screens/${shot.id}-mobile.png`);
    execFileSync(
      "node",
      ["scripts/capture.mjs", "--route", shot.route, "--out", mobileOut, "--width", "390"],
      { stdio: "inherit" },
    );
  }
}
