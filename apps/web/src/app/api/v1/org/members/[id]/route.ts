import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  role: z.enum(["owner", "admin", "member"]).optional(),
  status: z.enum(["active", "invited", "deactivated"]).optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const body = await parseJson(request, schema);
  if (!body.role && !body.status) throw new ApiError(422, "nothing_to_update", "Send a role or status.");
  if (body.role === "owner" && session.role !== "owner") {
    throw new ApiError(403, "forbidden", "Only an owner can promote another owner.");
  }

  const result = await workspaceRepo.updateMemberRole({ orgId: session.orgId, userId: session.id }, id, body);
  if (!result.ok) {
    if (result.reason === "not_found") throw new ApiError(404, "not_found", "That person is not in this workspace.");
    throw new ApiError(409, "last_owner", "A workspace needs at least one active owner. Promote someone else first.");
  }
  await recordAudit(session, {
    action: "member.updated",
    targetType: "user",
    targetId: id,
    metadata: body,
    ip: clientIp(request),
  });
  const members = await workspaceRepo.listMembers({ orgId: session.orgId, userId: session.id });
  return json({ member: members.find((member) => member.id === id) ?? null });
});
