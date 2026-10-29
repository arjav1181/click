import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { enqueue } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({ stage: z.enum(["transcribe", "summarize"]) });

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };
  const meeting = await meetingsRepo.getMeeting(ctx, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  if (meeting.ownerId !== session.id && !["owner", "admin"].includes(session.role)) {
    throw new ApiError(403, "forbidden", "Only the owner or an admin can retry processing.");
  }
  const body = await parseJson(request, schema);

  if (body.stage === "transcribe") {
    const recording = await meetingsRepo.getMeetingRecording(ctx, id);
    if (!recording) throw new ApiError(409, "no_recording", "This meeting has no stored recording.");
    await enqueue("transcribe", { orgId: session.orgId, meetingId: id, recordingId: recording.id });
  } else {
    const transcript = await meetingsRepo.getTranscript(ctx, id);
    if (!transcript.transcript) throw new ApiError(409, "no_transcript", "This meeting has no transcript.");
    await enqueue("summarize", { orgId: session.orgId, meetingId: id });
  }

  await recordAudit(session, {
    action: "meeting.retry",
    targetType: "meeting",
    targetId: id,
    metadata: { stage: body.stage },
    ip: clientIp(request),
  });
  return json({ ok: true, stage: body.stage }, { status: 202 });
});
