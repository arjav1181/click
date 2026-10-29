#!/usr/bin/env node
/**
 * Open the first audit row and capture the detail drawer.
 * Usage: node scripts/capture-detail.mjs --route /admin/audit --out /tmp/opencode/S58-detail.png
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import { ensureSession } from "./lib/session.mjs";

const CHROME = process.env.CHROME_PATH ?? "/repl/tools/bin/chromium";
const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.CAPTURE_EMAIL ?? "ava@click.local";
const PASSWORD = process.env.CAPTURE_PASSWORD ?? "click-demo-2026";

function parseArgs(argv) {
  const args = {
    route: "/admin/audit",
    out: "/tmp/opencode/detail.png",
    width: 1440,
    height: 1000,
    click: "View",
  };
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
    else if (name === "click") args.click = value;
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await page.setViewport({ width: args.width, height: args.height });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ensureSession(page, {
    baseUrl: BASE_URL,
    email: EMAIL,
    password: PASSWORD,
  });
  await sleep(300);
  await page.goto(`${BASE_URL}${args.route}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1200);

  const clicked = await page.evaluate((label) => {
    const nodes = Array.from(document.querySelectorAll("button, span, a"));
    const target = nodes.find((node) => node.textContent?.trim() === label);
    const button = target?.closest("button") ?? target;
    if (!button) return false;
    button.click();
    return true;
  }, args.click);
  if (!clicked) throw new Error("no View button found");
  await sleep(600);
  const hasDialog = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
  console.log(`dialog open: ${hasDialog}`);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();
  console.log(`captured detail -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
