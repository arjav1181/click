import { z } from "zod";
import { assertSameOrigin, handler, json, limit, parseJson } from "@/server/http";
import { sendMagicLink } from "@/server/auth";
import { isMailConfigured, isProduction } from "@click/backend";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(320),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  await limit(request, "magic-link", 5, 15 * 60_000);
  const body = await parseJson(request, schema);
  if (isProduction() && !isMailConfigured()) {
    return json(
      { error: { code: "mail_not_configured", message: "This instance has not configured SMTP yet." } },
      { status: 503 },
    );
  }
  const result = await sendMagicLink(body.email);
  // Always the same answer so the endpoint cannot be used to enumerate users.
  return json({ ok: true, ...(result.devLink ? { devLink: result.devLink } : {}) }, { status: 202 });
});
