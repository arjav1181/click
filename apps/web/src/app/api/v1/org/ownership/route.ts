import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  userId: z.string().uuid(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner"]);
  const body = await parseJson(request, schema);
  if (body.userId === session.id) {
    throw new ApiError(422, "already_owner", "You already own this workspace.");
  }

  const members = await workspaceRepo.listMembers({ orgId: session.orgId, userId: session.id });
  const target = members.find((member) => member.id === body.userId);
  if (!target) {
    throw new ApiError(404, "not_found", "That person is not in this workspace.");
  }
  if (target.status !== "active") {
    throw new ApiError(409, "inactive_member", "Activate the member before handing over ownership.");
  }

  const result = await workspaceRepo.transferOwnership(
    { orgId: session.orgId, userId: session.id },
    body.userId,
  );
  if (!result.ok) {
    throw new ApiError(404, "not_found", "That person is not in this workspace.");
  }

  await recordAudit(session, {
    action: "org.ownership_transferred",
    targetType: "user",
    targetId: body.userId,
    metadata: { from: session.id, to: body.userId },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
