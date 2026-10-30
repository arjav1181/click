import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const policy = await workspaceRepo.getRecordingPolicy({ orgId: session.orgId, userId: session.id });
  return json({ policy });
});

const patchSchema = z.object({
  autoJoinDefault: z.boolean().optional(),
  botName: z.string().trim().min(1).max(80).optional(),
  consentNotice: z.string().trim().min(1).max(2000).optional(),
  privateByDefault: z.boolean().optional(),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);

  const policy = await workspaceRepo.updateRecordingPolicy(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "recording_policy.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ policy });
});
