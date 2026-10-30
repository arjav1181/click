import { z } from "zod";
import { speakersRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await speakersRepo.renameSpeaker({ orgId: session.orgId, userId: session.id }, id, body.name);
  if (!result.ok) throw new ApiError(404, "not_found", "That speaker does not exist.");

  await recordAudit(session, {
    action: "speaker.renamed",
    targetType: "speaker",
    targetId: id,
    metadata: { name: body.name },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
