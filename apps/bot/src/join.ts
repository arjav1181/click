import type { Page } from "playwright-core";
import type { BotJoinRequest } from "./types";

export interface JoinHooks {
  log: (message: string) => void;
  onLobby: (detail: string) => Promise<void>;
  signal: AbortSignal;
  lobbyTimeoutMs: number;
}

export interface JoinResult {
  admitted: boolean;
  reason?: string;
  detail?: string;
}

const MEET_JOIN_BUTTONS = [
  'button:has-text("Ask to join")',
  'button:has-text("Join now")',
  'button:has-text("Join anyway")',
  'button[aria-label*="Ask to join" i]',
  'button[aria-label*="Join now" i]',
];

const MEET_NAME_INPUTS = [
  'input[aria-label="Your name"]',
  'input[placeholder="Your name"]',
  'input[aria-label*="name" i]',
];

/**
 * In-call only. The pre-join screen also shows a microphone button, so
 * matching that one would report admission before the bot is in the meeting.
 */
const MEET_ADMITTED = [
  '[aria-label*="Leave call" i]',
  '[aria-label*="Leave meeting" i]',
  'button[data-tooltip*="Leave call" i]',
  'button[data-tooltip*="Leave meeting" i]',
];

const MEET_DENIED = [
  "You can't join this meeting",
  "You can't join this video call",
  "Someone in the call denied your request",
  "You were removed from the meeting",
  "The call has ended",
];

const MEET_NOT_FOUND = [
  "Check your meeting code",
  "You may have entered the wrong meeting code",
  "No one is using this meeting code",
];

const MEET_LOBBY = [
  "Waiting for someone to let you in",
  "Asking to be let in",
  "You'll join the call when someone lets you in",
  "Waiting for the host",
];

const JITSI_JOIN_BUTTONS = [
  'button:has-text("Join meeting")',
  'button:has-text("Join")',
  '[data-testid="prejoin.joinMeeting"]',
];

const JITSI_NAME_INPUTS = [
  'input[placeholder="Your name"]',
  'input[name="displayName"]',
  'input[data-testid="prejoin.displayName"]',
];

const JITSI_ADMITTED = [
  '[aria-label*="Hang up" i]',
  '[aria-label*="Leave" i]',
  '[data-testid="toolbox.toggleChat"]',
];

const JITSI_LOBBY = ["Waiting for a moderator", "Waiting for the host", "You are the first one here"];

async function bodyText(page: Page): Promise<string> {
  try {
    return await page.locator("body").innerText({ timeout: 2_000 });
  } catch {
    return "";
  }
}

function containsAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export interface JoinStateOptions {
  deniedText: string[];
  notFoundText: string[];
  lobbyText: string[];
}

/**
 * Classifies the page text of a join screen. Pure so it can be tested without
 * a browser: the order matters because a denial page also says "Returning to
 * home screen".
 */
export function detectJoinState(
  text: string,
  options: JoinStateOptions,
): { reason: "join_denied" | "meeting_not_found" | "lobby"; detail: string } | null {
  if (containsAny(text, options.deniedText)) {
    const matched = options.deniedText.find((needle) => text.toLowerCase().includes(needle.toLowerCase()));
    return { reason: "join_denied", detail: matched ?? "The host denied the bot." };
  }
  if (containsAny(text, options.notFoundText)) {
    const matched = options.notFoundText.find((needle) => text.toLowerCase().includes(needle.toLowerCase()));
    return { reason: "meeting_not_found", detail: matched ?? "The meeting does not exist." };
  }
  if (containsAny(text, options.lobbyText)) {
    const matched = options.lobbyText.find((needle) => text.toLowerCase().includes(needle.toLowerCase()));
    return { reason: "lobby", detail: matched ?? "Waiting for admission" };
  }
  return null;
}

export const MEET_TEXT = {
  deniedText: MEET_DENIED,
  notFoundText: MEET_NOT_FOUND,
  lobbyText: MEET_LOBBY,
} satisfies JoinStateOptions;

export const JITSI_TEXT = {
  deniedText: ["You have been disconnected", "The meeting has been ended", "not allowed to join"],
  notFoundText: ["The meeting does not exist", "No one has joined the meeting yet", "invalid meeting"],
  lobbyText: JITSI_LOBBY,
} satisfies JoinStateOptions;

async function isVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 500 })) return true;
    } catch {
      /* try the next selector */
    }
  }
  return false;
}

async function clickFirst(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 750 })) {
        await locator.click({ timeout: 2_000 });
        return true;
      }
    } catch {
      /* the next selector may match the localized variant */
    }
  }
  return false;
}

async function fillFirst(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 750 })) {
        await locator.fill(value, { timeout: 2_000 });
        return true;
      }
    } catch {
      /* keep looking */
    }
  }
  return false;
}

async function postChatMessage(page: Page, notice: string): Promise<boolean> {
  const opened = await clickFirst(page, [
    'button[aria-label*="Chat with everyone" i]',
    'button[aria-label*="Chat" i]',
  ]);
  if (!opened) return false;
  const composerSelectors = [
    'textarea[aria-label*="Send a message" i]',
    'textarea[aria-label*="message" i]',
    'input[aria-label*="Send a message" i]',
    'div[contenteditable="true"]',
  ];
  for (const selector of composerSelectors) {
    try {
      const composer = page.locator(selector).last();
      if (!(await composer.isVisible({ timeout: 1_500 }))) continue;
      await composer.click();
      await composer.fill(notice);
      await composer.press("Enter");
      return true;
    } catch {
      /* try the next composer */
    }
  }
  return false;
}

async function muteMicrophone(page: Page): Promise<void> {
  await clickFirst(page, [
    'button[aria-label*="Turn off microphone" i]',
    'button[aria-label*="Mute microphone" i]',
    '[data-testid=" mute" i]',
  ]);
}

async function waitForAdmission(
  page: Page,
  options: {
    admittedSelectors: string[];
    text: JoinStateOptions;
    hooks: JoinHooks;
  },
): Promise<JoinResult> {
  const startedAt = Date.now();
  let lobbyReported = false;
  let lastText = "";

  while (Date.now() - startedAt < options.hooks.lobbyTimeoutMs) {
    if (options.hooks.signal.aborted) return { admitted: false, reason: "stopped" };
    if (await isVisible(page, options.admittedSelectors)) {
      return { admitted: true };
    }
    const text = await bodyText(page);
    lastText = text;

    const state = detectJoinState(text, options.text);
    if (state?.reason === "join_denied") {
      return { admitted: false, reason: "join_denied", detail: state.detail };
    }
    if (state?.reason === "meeting_not_found") {
      return { admitted: false, reason: "meeting_not_found", detail: state.detail };
    }
    if (state?.reason === "lobby" && !lobbyReported) {
      lobbyReported = true;
      await options.hooks.onLobby(state.detail);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return {
    admitted: false,
    reason: "lobby_timeout",
    detail: lastText.slice(0, 200) || "The host never admitted the bot.",
  };
}

async function joinMeet(page: Page, job: BotJoinRequest, hooks: JoinHooks): Promise<JoinResult> {
  await page.goto(job.meetingUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1_500);

  const filled = await fillFirst(page, MEET_NAME_INPUTS, job.botName);
  if (filled) hooks.log("guest name filled");
  await clickFirst(page, MEET_JOIN_BUTTONS);
  hooks.log("join requested");

  const result = await waitForAdmission(page, {
    admittedSelectors: MEET_ADMITTED,
    text: MEET_TEXT,
    hooks,
  });
  if (!result.admitted) return result;

  await muteMicrophone(page);
  const noticePosted = await postChatMessage(page, job.consentNotice);
  hooks.log(noticePosted ? "consent notice posted" : "consent notice could not be posted");
  return { ...result, detail: noticePosted ? "notice_posted" : "notice_not_posted" };
}

async function joinJitsi(page: Page, job: BotJoinRequest, hooks: JoinHooks): Promise<JoinResult> {
  await page.goto(job.meetingUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1_500);

  await fillFirst(page, JITSI_NAME_INPUTS, job.botName);
  if (job.passcode) {
    const passcodeFilled = await fillFirst(
      page,
      ['input[placeholder*="password" i]', 'input[type="password"]'],
      job.passcode,
    );
    if (passcodeFilled) await clickFirst(page, ['button:has-text("Enter")', 'button:has-text("Join")']);
  }
  await clickFirst(page, JITSI_JOIN_BUTTONS);
  hooks.log("join requested");

  const result = await waitForAdmission(page, {
    admittedSelectors: JITSI_ADMITTED,
    text: JITSI_TEXT,
    hooks,
  });
  if (!result.admitted) return result;
  await muteMicrophone(page);
  return result;
}

/**
 * The browser runner currently implements the two providers whose web clients
 * work without an app install or tenant-side app registration. The remaining
 * providers must use their official adapters; returning a specific error is
 * better than joining a download page and pretending it was a meeting.
 */
export async function joinMeeting(
  page: Page,
  job: BotJoinRequest,
  hooks: JoinHooks,
): Promise<JoinResult> {
  if (job.provider === "meet") return joinMeet(page, job, hooks);
  if (job.provider === "jitsi") return joinJitsi(page, job, hooks);
  return {
    admitted: false,
    reason: "provider_requires_official_adapter",
    detail: `The browser runner does not join ${job.provider} meetings. Configure the official adapter for that provider.`,
  };
}
