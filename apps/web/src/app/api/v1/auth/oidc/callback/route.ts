import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authRepo, hashPassword } from "@click/db";
import { appUrl, isOidcConfigured } from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { setSessionCookie } from "@/server/auth";
import { claims, exchangeCode } from "@/server/oidc";

export const GET = handler(async (request) => {
  if (!isOidcConfigured()) throw new ApiError(503, "oidc_not_configured", "Single sign-on is not configured.");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("click_oidc_state")?.value;
  const verifier = store.get("click_oidc_verifier")?.value;
  const expectedNonce = store.get("click_oidc_nonce")?.value;

  for (const name of ["click_oidc_state", "click_oidc_nonce", "click_oidc_verifier"]) {
    store.set(name, "", { path: "/", maxAge: 0 });
  }

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(`${appUrl()}/login?error=sso`);
  }

  try {
    const payload = await exchangeCode(code, verifier);
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new ApiError(401, "oidc_nonce", "The sign-in response did not match this request.");
    }
    const identity = claims(payload);
    if (!identity.email) throw new ApiError(401, "oidc_email", "The identity provider did not share an email address.");

    let user = await authRepo.findUserByEmail(identity.email);
    if (!user) {
      const created = await authRepo.createUser({
        email: identity.email,
        name: identity.name,
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        orgName: `${identity.email.split("@")[1] ?? identity.name}'s workspace`,
      });
      user = await authRepo.findUserByEmail(created.user.email);
    }
    if (!user) throw new ApiError(500, "oidc_user", "The account could not be created.");

    const session = await authRepo.createSession({ userId: user.id });
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.redirect(`${appUrl()}/app`);
  } catch (error) {
    console.error("[oidc] callback failed", error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${appUrl()}/login?error=sso`);
  }
});
