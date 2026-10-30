import { z } from "zod";
import { groupsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name.").max(120),
  priority: z.number().int().min(0).max(1000).optional(),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const groups = await groupsRepo.listGroups({ orgId: session.orgId, userId: session.id });
  return json({ groups });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, createSchema);

  const created = await groupsRepo.createGroup({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "group.created",
    targetType: "group",
    targetId: created.id,
    metadata: { name: body.name },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
