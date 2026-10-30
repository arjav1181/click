import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const policy = await workspaceRepo.getConsentPolicy({ orgId: session.orgId, userId: session.id });
  return json({ policy, role: session.role });
});

const patchSchema = z.object({
  recordingNotice: z.string().trim().min(1).max(2000).optional(),
  watermark: z.boolean().optional(),
  chatMessage: z.string().trim().min(1).max(2000).optional(),
  adminLocked: z.boolean().optional(),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const current = await workspaceRepo.getConsentPolicy({ orgId: session.orgId, userId: session.id });

  const isAdmin = session.role === "owner" || session.role === "admin";
  if (current.adminLocked && !isAdmin) {
    throw new ApiError(403, "admin_locked", "An admin has locked these settings.");
  }

  const body = await parseJson(request, patchSchema);

  if (body.adminLocked !== undefined && !isAdmin) {
    throw new ApiError(403, "forbidden", "Only admins can lock these settings.");
  }

  const policy = await workspaceRepo.updateConsentPolicy(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "consent.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ policy });
});
