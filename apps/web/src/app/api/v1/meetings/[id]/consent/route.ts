import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({ state: z.enum(["pending", "acknowledged", "declined"]) });

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };
  const meeting = await meetingsRepo.getMeeting(ctx, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const body = await parseJson(request, schema);
  await meetingsRepo.setConsent(ctx, id, body.state);
  await recordAudit(session, {
    action: "meeting.consent",
    targetType: "meeting",
    targetId: id,
    metadata: { state: body.state },
    ip: clientIp(request),
  });
  return json({ ok: true, consentState: body.state });
});
