import { z } from "zod";
import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  autoJoin: z.boolean().optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await calendarsRepo.updateCalendarConnection({ orgId: session.orgId, userId: session.id }, id, body);
  if (!result.ok) throw new ApiError(404, "not_found", "That connection does not exist.");

  await recordAudit(session, {
    action: "calendar.updated",
    targetType: "calendar_connection",
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

  const result = await calendarsRepo.deleteCalendarConnection({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That connection does not exist.");

  await recordAudit(session, {
    action: "calendar.disconnected",
    targetType: "calendar_connection",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
