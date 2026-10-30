import { sharingRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const DELETE = handler(async (request, context: { params: Promise<{ id: string; shareId: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id, shareId } = await context.params;

  const result = await sharingRepo.revokeShare({ orgId: session.orgId, userId: session.id }, shareId);
  if (!result.ok) throw new ApiError(404, "not_found", "That share does not exist.");

  await recordAudit(session, {
    action: "share.revoked",
    targetType: "meeting",
    targetId: id,
    metadata: { shareId },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
