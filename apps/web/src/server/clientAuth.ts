import { developersRepo, authRepo } from "@click/db";
import { ApiError, handler } from "./http";

/**
 * Authentication for the client apps (desktop, extension, mobile).
 *
 * The browser app signs in with a `click_session` cookie, which a native
 * client cannot use. Client apps instead present a scoped API key:
 * `Authorization: Bearer ck_…`. The key is looked up by hash, checked for the
 * scope the route needs, and the request is bound to that key's workspace.
 *
 * These routes are reachable from another origin (a `chrome-extension://`
 * page, an Electron `file://` page), so they send CORS headers. Because the
 * credential is a bearer token and never a cookie, a cross-origin page cannot
 * borrow a signed-in session.
 */

export interface ClientAuth {
  orgId: string;
  userId: string;
  keyId: string;
  scopes: string[];
}

/** Origins allowed to call the client API. Empty means "same origin only". */
function allowedOrigins(): string[] {
  const configured = process.env.CLIENT_API_ORIGINS ?? "";
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "600",
  };
  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    headers["Access-Control-Allow-Origin"] = allowed.includes("*") ? "*" : origin;
  }
  return headers;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Wraps the standard API handler and adds the CORS headers, so every client
 * route answers a cross-origin request the same way.
 */
export function clientHandler<Args extends unknown[]>(
  fn: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const response = await handler(fn)(request, ...args);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request))) {
      headers.set(key, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}

/** Answers the CORS preflight for a client route. */
export function clientOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders(new Request("http://localhost")) });
}

/**
 * Resolves the API key on a request. A key with no scopes can do nothing:
 * scopes are granted explicitly when the key is created.
 */
export async function requireClientAuth(request: Request, scope: string): Promise<ClientAuth> {
  const token = bearerToken(request);
  if (!token) {
    throw new ApiError(401, "missing_api_key", "Send an API key as `Authorization: Bearer ck_…`.");
  }
  const key = await developersRepo.verifyApiKey(token);
  if (!key) {
    throw new ApiError(401, "invalid_api_key", "That API key is not valid or has been revoked.");
  }
  if (!key.scopes.includes(scope)) {
    throw new ApiError(
      403,
      "insufficient_scope",
      `This API key needs the ${scope} scope. Create a key with that scope under Developers.`,
    );
  }
  // The key's owner must still be an active member of the workspace.
  const memberships = await authRepo.listMemberships(key.userId);
  const membership = memberships.find((entry) => entry.orgId === key.orgId);
  if (!membership) {
    throw new ApiError(403, "no_workspace", "This API key's account is not a member of the workspace.");
  }
  return { orgId: key.orgId, userId: key.userId, keyId: key.id, scopes: key.scopes };
}
