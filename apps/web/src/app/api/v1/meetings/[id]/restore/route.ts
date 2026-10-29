import { meetingsRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const existing = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!existing) throw new ApiError(404, "not_found", "Meeting not found.");
  if (existing.ownerId !== session.id && !["owner", "admin"].includes(session.role)) {
    throw new ApiError(403, "forbidden", "Only the meeting owner or an admin can restore it.");
  }
  await meetingsRepo.restoreMeeting({ orgId: session.orgId, userId: session.id }, id);
  await recordAudit(session, {
    action: "meeting.restored",
    targetType: "meeting",
    targetId: id,
    ip: clientIp(request),
  });
  return json({ ok: true });
});
