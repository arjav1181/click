/**
 * Shared session handling for the screenshot scripts.
 *
 * The login endpoint is rate limited, so the session cookie is cached on disk
 * and reused. The cache is keyed by the base URL and account.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "click_session";
const CACHE_PATH = "/tmp/opencode/click-session.json";

function cacheFile(baseUrl, email) {
  const safe = `${baseUrl}|${email}`.replace(/[^a-zA-Z0-9]/g, "_");
  return `${CACHE_PATH}.${safe}`;
}

function readCached(baseUrl, email) {
  const path = cacheFile(baseUrl, email);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed.value !== "string" || !parsed.value) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCached(baseUrl, email, value) {
  const path = cacheFile(baseUrl, email);
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ value, savedAt: Date.now() }));
}

/**
 * Returns a session cookie value for the demo account, logging in only when
 * the cached cookie is missing or no longer accepted.
 */
export async function ensureSession(page, { baseUrl, email, password }) {
  const cached = readCached(baseUrl, email);
  if (cached) {
    const ok = await applyAndVerify(page, baseUrl, cached.value);
    if (ok) return cached.value;
  }

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const login = await page.evaluate(
    async (mail, secret) => {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail, password: secret }),
      });
      return { status: response.status, body: await response.text() };
    },
    email,
    password,
  );
  if (login.status !== 200) {
    // The login endpoint is rate limited per account. Operators can mint a
    // session token directly, which is what the capture tooling falls back to.
    if (login.status === 429) {
      const token = mintSessionToken(email);
      writeCached(baseUrl, email, token);
      return token;
    }
    throw new Error(`login failed (${login.status}): ${login.body}`);
  }

  const cookies = await page.cookies(baseUrl);
  const session = cookies.find((cookie) => cookie.name === COOKIE_NAME);
  if (!session?.value) throw new Error("login did not set a session cookie");
  writeCached(baseUrl, email, session.value);
  return session.value;
}

async function applyAndVerify(page, baseUrl, value) {
  await page.setCookie({
    name: COOKIE_NAME,
    value,
    domain: new URL(baseUrl).hostname,
    path: "/",
    httpOnly: true,
  });
  await page.goto(`${baseUrl}/api/v1/auth/session`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const status = await page.evaluate(() => document.body.innerText);
  return status.includes("ava@click.local") || status.includes("ava@click");
}

/**
 * Mints a session token through the operator CLI. Used when the login
 * endpoint has rate limited the demo account.
 */
function mintSessionToken(email) {
  const output = execFileSync(
    "pnpm",
    ["--filter", "@click/db", "cli", "session-token", email],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  const token = output.trim().split("\n").at(-1)?.trim();
  if (!token) throw new Error("could not mint a session token");
  return token;
}
