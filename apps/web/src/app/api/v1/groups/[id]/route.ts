import { z } from "zod";
import { groupsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  templateId: z.string().uuid().nullable().optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await groupsRepo.updateGroup({ orgId: session.orgId, userId: session.id }, id, body);
  if (!result.ok) throw new ApiError(404, "not_found", "That group does not exist.");

  await recordAudit(session, {
    action: "group.updated",
    targetType: "group",
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

  const result = await groupsRepo.deleteGroup({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That group does not exist.");

  await recordAudit(session, {
    action: "group.deleted",
    targetType: "group",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
