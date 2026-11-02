import { meetingsRepo } from "@click/db";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";
import { ApiError } from "@/server/http";

/**
 * The transcript so far, for the live overlay in the extension and the live
 * notes window on the desktop. A client polls this while the meeting runs.
 */
export const GET = clientHandler(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const auth = await requireClientAuth(request, "transcripts:read");
    const ctx = { orgId: auth.orgId, userId: auth.userId };
    const meeting = await meetingsRepo.getMeeting(ctx, id);
    if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
    const transcript = await meetingsRepo.getTranscript(ctx, id);
    return Response.json({
      meetingId: id,
      status: meeting.status,
      transcript: transcript.transcript,
      segments: transcript.segments,
    });
  },
);
