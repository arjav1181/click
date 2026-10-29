#!/usr/bin/env node
/**
 * Capture a screenshot of a Click screen for the clone parity set.
 *
 * Usage:
 *   node scripts/capture.mjs --route /app/tasks --out replica/clone-screens/S36.png
 *   node scripts/capture.mjs --route /app/tasks --out replica/clone-screens/S36-mobile.png --width 390
 *
 * The script signs in with the demo account, waits for the route to settle,
 * fails on console errors and writes a full-page PNG.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/repl/tools/bin/chromium";
const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.CAPTURE_EMAIL ?? "ava@click.local";
const PASSWORD = process.env.CAPTURE_PASSWORD ?? "click-demo-2026";

function parseArgs(argv) {
  const args = { route: "/app", out: "replica/clone-screens/shot.png", width: 1440, height: 1000 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    i += 1;
    if (name === "route") args.route = value;
    else if (name === "out") args.out = value;
    else if (name === "width") args.width = Number(value);
    else if (name === "height") args.height = Number(value);
  }
  return args;
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = resolve(args.out);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: args.width, height: args.height, deviceScaleFactor: 1 });

  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("favicon")) {
      errors.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const login = await page.evaluate(
    async (email, password) => {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return { status: response.status, body: await response.text() };
    },
    EMAIL,
    PASSWORD,
  );
  if (login.status !== 200) {
    throw new Error(`login failed (${login.status}): ${login.body}`);
  }
  await sleep(300);

  await page.goto(`${BASE_URL}${args.route}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(900);

  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  const filtered = errors.filter(
    (line) =>
      !line.includes("favicon") &&
      !line.includes("/_next/hmr") &&
      !line.includes("WebSocket connection") &&
      !line.startsWith("Failed to load resource"),
  );
  if (filtered.length) {
    console.error(`console errors on ${args.route}:\n${filtered.join("\n")}`);
    process.exitCode = 1;
  }
  console.log(`captured ${args.route} -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
