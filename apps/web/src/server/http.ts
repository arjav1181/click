import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";
import { NextResponse } from "next/server";
import { BudgetExceededError } from "@click/backend";
import { rateLimit } from "@click/backend";
import { appUrl } from "@click/backend";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

export function noContent() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
}

/**
 * Wraps a route handler: consistent JSON errors, no stack traces, no user data
 * in the response. Every API route is wrapped, so unexpected throws cannot
 * leak internals.
 */
export function handler<Args extends unknown[]>(
  fn: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const id = requestId(request);
    try {
      return await fn(request, ...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return json(
          { error: { code: error.code, message: error.message, details: error.details }, requestId: id },
          { status: error.status },
        );
      }
      if (error instanceof ZodError) {
        return json(
          {
            error: {
              code: "invalid_request",
              message: "Some fields need attention.",
              details: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
              })),
            },
            requestId: id,
          },
          { status: 422 },
        );
      }
      if (error instanceof BudgetExceededError) {
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              details: { cap: error.cap, spent: error.spent },
            },
            requestId: id,
          },
          { status: 402 },
        );
      }
      console.error(`[api] ${id} ${request.method} ${new URL(request.url).pathname}`, error);
      return json(
        { error: { code: "internal_error", message: "Something went wrong. Try again." }, requestId: id },
        { status: 500 },
      );
    }
  };
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Send the body as application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_000_000) {
    throw new ApiError(413, "payload_too_large", "JSON bodies are limited to 1 MB.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body is not valid JSON.");
  }
  return schema.parse(body);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

/**
 * CSRF defence for cookie-authenticated mutations: when a browser sends an
 * Origin header it must match the configured app origin. Requests without an
 * Origin (curl, server-to-server) still need a valid session cookie.
 */
export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(appUrl()).origin);
    allowed.add(new URL(request.url).origin);
  } catch {
    // misconfigured APP_URL is caught by the comparison below
  }
  if (!allowed.has(origin)) {
    throw new ApiError(403, "bad_origin", "This request came from an origin that is not allowed.");
  }
}

export async function limit(
  request: Request,
  bucket: string,
  maximum: number,
  windowMs: number,
  extraKey = "",
): Promise<void> {
  const key = `${bucket}:${clientIp(request)}${extraKey ? `:${extraKey}` : ""}`;
  const result = await rateLimit(key, maximum, windowMs);
  if (!result.ok) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new ApiError(429, "rate_limited", `Too many attempts. Try again in ${retryAfter} seconds.`, {
      retryAfter,
    });
  }
}

export function requireEnvValue(value: string | undefined, name: string): string {
  if (!value) throw new ApiError(503, "not_configured", `${name} is not configured on this instance.`);
  return value;
}
