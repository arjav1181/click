import { z } from "zod";
import { speakersRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);

  const result = await speakersRepo.mergeSpeakers(
    { orgId: session.orgId, userId: session.id },
    body.sourceId,
    body.targetId,
  );
  if (!result.ok) throw new ApiError(422, "merge_failed", "Both speakers must exist in this workspace.");

  await recordAudit(session, {
    action: "speaker.merged",
    targetType: "speaker",
    targetId: body.targetId,
    metadata: { sourceId: body.sourceId },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
