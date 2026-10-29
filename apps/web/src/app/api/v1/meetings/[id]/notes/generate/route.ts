import { z } from "zod";
import { eq } from "drizzle-orm";
import { meetings, meetingsRepo, notesRepo, withTenant } from "@click/db";
import { enqueue } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  length: z.enum(["short", "standard", "detailed"]).default("standard"),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };
  const meeting = await meetingsRepo.getMeeting(ctx, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const transcript = await meetingsRepo.getTranscript(ctx, id);
  if (!transcript.transcript || transcript.segments.length === 0) {
    throw new ApiError(409, "no_transcript", "Transcribe this meeting before generating notes.");
  }
  if (transcript.transcript.status !== "ready") {
    throw new ApiError(409, "transcript_not_ready", "The transcript is still processing.");
  }

  const body = await parseJson(request, schema);
  const note = await notesRepo.markNoteGenerating(ctx, id, body.templateId ?? null);
  await withTenant(ctx, async (tx) => {
    await tx.update(meetings).set({ status: "processing", failureReason: null }).where(eq(meetings.id, id));
  });
  await enqueue("summarize", {
    orgId: session.orgId,
    meetingId: id,
    templateId: body.templateId ?? null,
    length: body.length,
  });
  await recordAudit(session, {
    action: "note.generation_queued",
    targetType: "note",
    targetId: note.noteId,
    metadata: { meetingId: id, length: body.length },
    ip: clientIp(request),
  });
  return json({ noteId: note.noteId, status: "generating" }, { status: 202 });
});
