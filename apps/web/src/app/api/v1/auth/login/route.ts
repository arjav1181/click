import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp } from "@/server/http";
import { ApiError } from "@/server/http";
import { loginWithPassword, sessionDto, setSessionCookie } from "@/server/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(320),
  password: z.string().min(1, "Enter your password.").max(512),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const body = await parseJson(request, schema);
  await limit(request, "login", 10, 5 * 60_000, body.email);
  const result = await loginWithPassword({
    email: body.email,
    password: body.password,
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  if (!result) {
    throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
  }
  await setSessionCookie(result.token, result.expiresAt);
  return json(sessionDto(result.user));
});
