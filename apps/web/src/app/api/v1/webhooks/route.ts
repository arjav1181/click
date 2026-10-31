import { z } from "zod";
import { developersRepo, randomToken, sha256 } from "@click/db";
import { encryptSecret } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  url: z.string().trim().url("Enter a full https:// URL.").max(2000),
  events: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const endpoints = await developersRepo.listWebhooks({ orgId: session.orgId, userId: session.id });
  return json({
    endpoints,
    events: developersRepo.availableWebhookEvents(),
  });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, createSchema);

  const invalid = body.events.filter((event) => !developersRepo.availableWebhookEvents().includes(event));
  if (invalid.length) {
    throw new ApiError(422, "invalid_event", `Unknown events: ${invalid.join(", ")}.`);
  }

  // The secret is shown once. It is stored encrypted so deliveries can be
  // signed, and hashed so it can never be read back from the database.
  const secret = `whsec_${randomToken(32)}`;
  const created = await developersRepo.createWebhook(
    { orgId: session.orgId, userId: session.id },
    {
      url: body.url,
      events: body.events,
      secretHash: sha256(secret),
      secretEnc: encryptSecret(secret),
    },
  );
  await recordAudit(session, {
    action: "webhook.created",
    targetType: "webhook",
    targetId: created.id,
    metadata: { url: body.url, events: body.events },
    ip: clientIp(request),
  });
  return json({ id: created.id, secret }, { status: 201 });
});
