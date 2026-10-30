import { z } from "zod";
import { retentionRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const policy = await retentionRepo.getRetentionPolicy({ orgId: session.orgId, userId: session.id });
  return json({ policy });
});

const patchSchema = z.object({
  transcriptDays: z.number().int().min(1).max(3650).nullable().optional(),
  audioDays: z.number().int().min(0).max(3650).nullable().optional(),
  recordingMode: z.enum(["audio", "audio_video", "transcript_only"]).optional(),
  legalHoldOverride: z.boolean().optional(),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);

  const policy = await retentionRepo.upsertRetentionPolicy(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "retention.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ policy });
});
