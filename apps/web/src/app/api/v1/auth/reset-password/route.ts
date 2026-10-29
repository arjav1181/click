import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp } from "@/server/http";
import { resetPasswordWithToken, sessionDto, setSessionCookie } from "@/server/auth";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10, "Use at least 10 characters.").max(512),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "reset-password", 10, 15 * 60_000);
  const body = await parseJson(request, schema);
  const result = await resetPasswordWithToken({
    ...body,
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  await setSessionCookie(result.token, result.expiresAt);
  return json(sessionDto(result.user));
});
