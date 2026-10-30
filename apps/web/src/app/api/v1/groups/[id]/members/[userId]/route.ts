import { groupsRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const DELETE = handler(async (request, context: { params: Promise<{ id: string; userId: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id, userId } = await context.params;

  await groupsRepo.removeGroupMember({ orgId: session.orgId, userId: session.id }, id, userId);

  await recordAudit(session, {
    action: "group.member_removed",
    targetType: "group",
    targetId: id,
    metadata: { userId },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
