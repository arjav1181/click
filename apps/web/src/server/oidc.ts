import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { oidcConfig, appUrl } from "@click/backend";
import { ApiError } from "./http";

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

let cached: { value: Discovery; expiresAt: number } | null = null;

export async function discover(): Promise<Discovery> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const config = oidcConfig();
  if (!config.issuer) throw new ApiError(503, "oidc_not_configured", "OIDC is not configured.");
  const url = `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new ApiError(502, "oidc_discovery_failed", "The identity provider did not answer.");
  const value = (await response.json()) as Discovery;
  cached = { value, expiresAt: Date.now() + 60 * 60_000 };
  return value;
}

export function redirectUri() {
  return process.env.OIDC_REDIRECT_URI ?? `${appUrl()}/api/v1/auth/oidc/callback`;
}

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function authorizationUrl(input: { state: string; nonce: string; challenge: string }) {
  const discovery = await discover();
  const config = oidcConfig();
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<JWTPayload> {
  const discovery = await discover();
  const config = oidcConfig();
  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new ApiError(401, "oidc_token_failed", "The identity provider rejected the sign-in.");
  }
  const tokens = (await response.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw new ApiError(401, "oidc_token_failed", "The identity provider did not return an ID token.");

  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: discovery.issuer,
    audience: config.clientId,
  });
  return payload;
}

export function claims(payload: JWTPayload) {
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const name =
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.preferred_username === "string" && payload.preferred_username) ||
    email.split("@")[0] ||
    "Member";
  return {
    email,
    name: name.slice(0, 120),
    emailVerified: payload.email_verified === true,
    subject: String(payload.sub ?? ""),
  };
}
