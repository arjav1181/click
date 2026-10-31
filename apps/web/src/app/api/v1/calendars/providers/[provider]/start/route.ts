import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  calendarAuthorizeUrl,
  isCalendarProviderConfigured,
  pkcePair,
  type CalendarProviderName,
} from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

const STATE_COOKIE = "click_calendar_state";
const VERIFIER_COOKIE = "click_calendar_verifier";

function providerFrom(value: string): CalendarProviderName {
  if (value === "google" || value === "microsoft") return value;
  throw new ApiError(404, "not_found", "That calendar provider does not exist.");
}

/**
 * Starts the OAuth consent flow. The state and the PKCE verifier live in
 * short-lived httpOnly cookies so the callback can prove it belongs to this
 * browser session.
 */
export const GET = handler(async (_request, context: { params: Promise<{ provider: string }> }) => {
  const session = await requireOrgSession();
  const { provider } = await context.params;
  const name = providerFrom(provider);
  if (!isCalendarProviderConfigured(name)) {
    throw new ApiError(
      503,
      "calendar_not_configured",
      `${name === "google" ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID"} is not set on this instance.`,
    );
  }

  const state = randomBytes(16).toString("base64url");
  const { verifier, challenge } = pkcePair();
  const url = calendarAuthorizeUrl(name, state, challenge);

  const response = NextResponse.redirect(url);
  const secure = process.env.APP_URL?.startsWith("https://") ?? false;
  response.cookies.set(STATE_COOKIE, `${name}.${state}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/calendars",
    maxAge: 600,
    secure,
  });
  response.cookies.set(VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/calendars",
    maxAge: 600,
    secure,
  });
  // The session is required but the provider redirect carries no session cookie
  // of its own; the cookie check above keeps the flow behind a login.
  void session;
  return response;
});
