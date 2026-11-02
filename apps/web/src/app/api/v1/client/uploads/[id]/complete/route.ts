import { eq } from "drizzle-orm";
import { meetings, recordings, uploadsRepo, withTenant } from "@click/db";
import {
  completeMultipartUpload,
  enqueue,
  emitWebhookEvent,
  uploadLimits,
} from "@click/backend";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";
import { ApiError } from "@/server/http";

/**
 * Joins the chunks into the recording and starts the normal transcription
 * pipeline, so a client recording ends up in the workspace like any other
 * meeting.
 */
export const POST = clientHandler(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const auth = await requireClientAuth(request, "recordings:write");
    const ctx = { orgId: auth.orgId, userId: auth.userId };
    const session = await uploadsRepo.getUploadSession(ctx, id);
    if (!session) throw new ApiError(404, "not_found", "Upload not found.");
    if (session.state === "completed") {
      return Response.json({ ok: true, meetingId: session.meetingId, state: session.state });
    }
    const meetingId = session.meetingId;
    if (!meetingId) {
      throw new ApiError(409, "no_meeting", "This upload is not attached to a meeting.");
    }

    const chunks = await uploadsRepo.listUploadChunks(ctx, session.id);
    if (chunks.length === 0) {
      throw new ApiError(422, "no_chunks", "No audio was uploaded.");
    }
    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
    const limits = uploadLimits();
    if (totalBytes > limits.maxBytes) {
      throw new ApiError(
        413,
        "file_too_large",
        `Uploads are limited to ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`,
      );
    }

    await completeMultipartUpload(
      session.storageKey,
      session.storageUploadId ?? "local",
      chunks.map((chunk) => ({
        partNumber: chunk.chunkIndex + 1,
        etag: chunk.etag ?? undefined,
      })),
    );

    const recording = await withTenant(ctx, async (tx) => {
      const rows = await tx
        .insert(recordings)
        .values({
          orgId: auth.orgId,
          meetingId,
          storageKey: session.storageKey,
          kind: "audio",
          codec: session.codec,
          sizeBytes: totalBytes,
        })
        .returning({ id: recordings.id });
      await tx
        .update(meetings)
        .set({ status: "processing", endedAt: new Date() })
        .where(eq(meetings.id, meetingId));
      return rows[0];
    });

    await uploadsRepo.markUploadSession(ctx, session.id, "completed");
    await enqueue("transcribe", {
      orgId: auth.orgId,
      meetingId,
      recordingId: recording.id,
    });
    await emitWebhookEvent(auth.orgId, "meeting.ready", {
      meetingId,
      title: session.title,
    });

    return Response.json(
      {
        ok: true,
        meetingId,
        recordingId: recording.id,
        bytes: totalBytes,
        state: "completed",
      },
      { status: 202 },
    );
  },
);
