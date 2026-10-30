import { z } from "zod";
import { developersRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  url: z.string().trim().url("Enter a full https:// URL.").max(2000).optional(),
  events: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  active: z.boolean().optional(),
});

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const endpoints = await developersRepo.listWebhooks({ orgId: session.orgId, userId: session.id });
  const endpoint = endpoints.find((entry) => entry.id === id);
  if (!endpoint) throw new ApiError(404, "not_found", "That webhook does not exist.");
  return json({ endpoint });
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  if (body.events) {
    const invalid = body.events.filter((event) => !developersRepo.availableWebhookEvents().includes(event));
    if (invalid.length) {
      throw new ApiError(422, "invalid_event", `Unknown events: ${invalid.join(", ")}.`);
    }
  }

  const result = await developersRepo.updateWebhook(
    { orgId: session.orgId, userId: session.id },
    id,
    body,
  );
  if (!result.ok) throw new ApiError(404, "not_found", "That webhook does not exist.");

  await recordAudit(session, {
    action: "webhook.updated",
    targetType: "webhook",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ ok: true });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;

  const result = await developersRepo.deleteWebhook({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That webhook does not exist.");

  await recordAudit(session, {
    action: "webhook.deleted",
    targetType: "webhook",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
