import { meetingsRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const meeting = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const transcript = await meetingsRepo.getTranscript({ orgId: session.orgId, userId: session.id }, id);
  return json({ transcript: transcript.transcript, segments: transcript.segments });
});
