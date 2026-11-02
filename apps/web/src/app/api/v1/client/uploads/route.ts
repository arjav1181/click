import { z } from "zod";
import { meetingsRepo, uploadsRepo } from "@click/db";
import {
  CHUNK_SIZE,
  createMultipartUpload,
  extensionFor,
  newStorageKey,
  uploadLimits,
} from "@click/backend";
import { clientHandler, requireClientAuth } from "@/server/clientAuth";
import { ApiError } from "@/server/http";

const schema = z.object({
  title: z.string().trim().min(1, "Give the recording a title.").max(300),
  meetingId: z.string().uuid().optional(),
  mime: z.string().trim().min(1).max(120).default("audio/webm"),
  filename: z.string().trim().max(300).optional(),
  totalBytes: z.number().int().positive().optional(),
  source: z.enum(["desktop", "extension", "mobile", "api"]).default("api"),
});

/**
 * Starts a chunked upload. The client creates the meeting up front (so the
 * meeting shows up in the workspace while the recording is still running) and
 * passes its id here, or lets the server create one.
 */
export const POST = clientHandler(async (request) => {
  const auth = await requireClientAuth(request, "recordings:write");
  const body = schema.parse(await request.json());
  const limits = uploadLimits();
  if (body.totalBytes && body.totalBytes > limits.maxBytes) {
    throw new ApiError(
      413,
      "file_too_large",
      `Uploads are limited to ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`,
    );
  }
  if (!limits.allowedMime.has(body.mime)) {
    throw new ApiError(415, "unsupported_file", "Use an audio or video file.");
  }

  const ctx = { orgId: auth.orgId, userId: auth.userId };
  let meetingId = body.meetingId ?? null;
  if (meetingId) {
    const meeting = await meetingsRepo.getMeeting(ctx, meetingId);
    if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  } else {
    const meeting = await meetingsRepo.createMeeting(ctx, {
      title: body.title,
      source: body.source,
      status: "live",
      startedAt: new Date(),
    });
    meetingId = meeting.id;
  }

  const codec = extensionFor(body.mime, body.filename);
  const storageKey = newStorageKey(auth.orgId, meetingId, body.mime, body.filename);
  const { uploadId } = await createMultipartUpload(storageKey, body.mime);
  const session = await uploadsRepo.createUploadSession(ctx, {
    meetingId,
    title: body.title,
    mime: body.mime,
    codec,
    storageKey,
    storageUploadId: uploadId,
    chunkSize: CHUNK_SIZE,
    totalBytes: body.totalBytes ?? null,
  });

  return Response.json(
    {
      uploadId: session.id,
      meetingId,
      chunkSize: session.chunkSize,
      receivedChunks: [] as number[],
      receivedBytes: session.receivedBytes,
      state: session.state,
    },
    { status: 201 },
  );
});
