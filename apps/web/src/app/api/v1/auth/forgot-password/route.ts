import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson } from "@/server/http";
import { requestPasswordReset } from "@/server/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(320),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "forgot-password", 5, 15 * 60_000);
  const body = await parseJson(request, schema);
  const result = await requestPasswordReset(body.email);
  return json({ ok: true, ...(result.devLink ? { devLink: result.devLink } : {}) }, { status: 202 });
});
