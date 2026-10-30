import { developersRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;

  const result = await developersRepo.revokeApiKey({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) {
    throw new ApiError(404, "not_found", "That key does not exist or is already revoked.");
  }
  await recordAudit(session, {
    action: "api_key.revoked",
    targetType: "api_key",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
