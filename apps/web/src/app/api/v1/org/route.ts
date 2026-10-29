import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  const members = await workspaceRepo.listMembers({ orgId: session.orgId, userId: session.id });
  return json({
    org: org ?? null,
    role: session.role,
    counts: {
      members: members.length,
      active: members.filter((member) => member.status === "active").length,
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  domainAllowlist: z.array(z.string().trim().toLowerCase().max(200)).max(50).optional(),
});

export const PATCH = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);
  await workspaceRepo.updateOrganization({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "org.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  return json({ org });
});
