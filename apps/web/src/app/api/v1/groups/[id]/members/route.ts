import { z } from "zod";
import { groupsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  userId: z.string().uuid(),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const result = await groupsRepo.addGroupMember({ orgId: session.orgId, userId: session.id }, id, body.userId);
  if (!result.ok) throw new ApiError(404, "not_found", "That group does not exist.");

  await recordAudit(session, {
    action: "group.member_added",
    targetType: "group",
    targetId: id,
    metadata: { userId: body.userId },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
