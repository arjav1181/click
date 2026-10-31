import { NextResponse } from "next/server";
import {
  calendarAccountEmail,
  completeCalendarConnection,
  enqueue,
  exchangeCalendarCode,
  type CalendarProviderName,
} from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const STATE_COOKIE = "click_calendar_state";
const VERIFIER_COOKIE = "click_calendar_verifier";

export const GET = handler(async (request, context: { params: Promise<{ provider: string }> }) => {
  const session = await requireOrgSession();
  const { provider } = await context.params;
  if (provider !== "google" && provider !== "microsoft") {
    throw new ApiError(404, "not_found", "That calendar provider does not exist.");
  }
  const name = provider as CalendarProviderName;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookies = request.headers.get("cookie") ?? "";
  const storedState = readCookie(cookies, STATE_COOKIE);
  const verifier = readCookie(cookies, VERIFIER_COOKIE);

  const redirect = (target: string, message?: string) => {
    const response = NextResponse.redirect(new URL(target, request.url));
    response.cookies.delete(STATE_COOKIE);
    response.cookies.delete(VERIFIER_COOKIE);
    if (message) response.cookies.set("click_calendar_error", message, { path: "/settings/calendars", maxAge: 60 });
    return response;
  };

  if (error) return redirect("/settings/calendars", `The calendar connection was declined (${error}).`);
  if (!code || !state || !verifier || storedState !== `${name}.${state}`) {
    return redirect("/settings/calendars", "The calendar connection could not be verified. Try again.");
  }

  try {
    const tokens = await exchangeCalendarCode(name, code, verifier);
    if (!tokens.refreshToken) throw new Error("The provider did not return a refresh token.");
    const accountEmail = await calendarAccountEmail(name, tokens.accessToken);
    const connection = await completeCalendarConnection(session.orgId, session.id, name, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accountEmail,
    });
    await recordAudit(session, {
      action: "calendar.connected",
      targetType: "calendar_connection",
      targetId: connection.id,
      metadata: { provider: name },
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });
    await enqueue("calendar", { orgId: session.orgId, connectionId: connection.id });
    return redirect("/settings/calendars");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.slice(0, 200) : "Unknown error";
    return redirect("/settings/calendars", `The calendar connection failed: ${message}`);
  }
});

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
