import { z } from "zod";
import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  // null clears the manual override so the workspace rules decide again.
  autoJoin: z.boolean().nullable(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await calendarsRepo.setEventAutoJoin({ orgId: session.orgId, userId: session.id }, id, body.autoJoin);
  if (!result.ok) throw new ApiError(404, "not_found", "That calendar event does not exist.");

  await recordAudit(session, {
    action: "calendar_event.updated",
    targetType: "calendar_event",
    targetId: id,
    metadata: { autoJoin: body.autoJoin },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
