import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  text: z.string().trim().min(1).max(2000).optional(),
  assigneeName: z.string().trim().max(120).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(["open", "done", "cancelled"]).optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);
  const updated = await workspaceRepo.updateActionItem({ orgId: session.orgId, userId: session.id }, id, {
    ...body,
    dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
  });
  if (!updated) throw new ApiError(404, "not_found", "Action item not found.");
  await recordAudit(session, {
    action: "action_item.updated",
    targetType: "action_item",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ ok: true });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const deleted = await workspaceRepo.deleteActionItem({ orgId: session.orgId, userId: session.id }, id);
  if (!deleted) throw new ApiError(404, "not_found", "Action item not found.");
  await recordAudit(session, {
    action: "action_item.deleted",
    targetType: "action_item",
    targetId: id,
    ip: clientIp(request),
  });
  return new Response(null, { status: 204 });
});
