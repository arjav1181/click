import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson } from "@/server/http";
import { sessionDto, verifyEmailToken } from "@/server/auth";

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "verify-email", 10, 15 * 60_000);
  const body = await parseJson(request, schema);
  const user = await verifyEmailToken(body.token);
  return json(sessionDto(user));
});
