import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson, clientIp } from "@/server/http";
import { consumeMagicLink, sessionDto, setSessionCookie } from "@/server/auth";

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "magic-consume", 10, 15 * 60_000);
  const body = await parseJson(request, schema);
  const result = await consumeMagicLink(body.token);
  await setSessionCookie(result.token, result.expiresAt);
  return json(sessionDto(result.user));
});
