import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appUrl, isOidcConfigured } from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { authorizationUrl, pkcePair } from "@/server/oidc";

const TEN_MINUTES = 10 * 60;

export const GET = handler(async () => {
  if (!isOidcConfigured()) throw new ApiError(503, "oidc_not_configured", "Single sign-on is not configured.");
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const { verifier, challenge } = pkcePair();
  const url = await authorizationUrl({ state, nonce, challenge });

  const store = await cookies();
  const secure = appUrl().startsWith("https://");
  for (const [name, value] of [
    ["click_oidc_state", state],
    ["click_oidc_nonce", nonce],
    ["click_oidc_verifier", verifier],
  ] as const) {
    store.set(name, value, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: TEN_MINUTES,
    });
  }
  return NextResponse.redirect(url);
});
