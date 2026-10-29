import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp } from "@/server/http";
import { registerAccount, sessionDto, setSessionCookie } from "@/server/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(320),
  password: z.string().min(10, "Use at least 10 characters.").max(512),
  orgName: z.string().trim().min(1).max(120).optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "register", 5, 15 * 60_000);
  const body = await parseJson(request, schema);
  const result = await registerAccount({
    ...body,
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  await setSessionCookie(result.token, result.expiresAt);
  return json(sessionDto(result.user), { status: 201 });
});
