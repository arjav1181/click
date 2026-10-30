import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

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
