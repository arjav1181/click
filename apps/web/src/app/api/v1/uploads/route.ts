import { recordings, meetingsRepo, withTenant } from "@click/db";
import { enqueue, newStorageKey, putObject, uploadLimits, extensionFor } from "@click/backend";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";
import { requireBudget, requireFeature } from "@/server/policy";

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  await requireFeature(session.orgId, session.id, "transcription");
  await requireBudget(session.orgId);
  const limits = uploadLimits();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limits.maxBytes) {
    throw new ApiError(413, "file_too_large", `Uploads are limited to ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "invalid_upload", "Send the recording as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "file_required", "Attach an audio or video file.");
  if (file.size === 0) throw new ApiError(422, "empty_file", "That file is empty.");
  if (file.size > limits.maxBytes) {
    throw new ApiError(413, "file_too_large", `Uploads are limited to ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`);
  }
  const mime = file.type || "application/octet-stream";
  const ext = extensionFor(mime, file.name);
  if (!limits.allowedMime.has(mime) && !["mp3", "wav", "webm", "ogg", "m4a", "mp4", "mov", "flac"].includes(ext)) {
    throw new ApiError(415, "unsupported_file", "Use an audio or video file (mp3, wav, webm, ogg, m4a, mp4, mov, flac).");
  }

  const ctx = { orgId: session.orgId, userId: session.id };
  const titleFromForm = String(form.get("title") ?? "").trim().slice(0, 300);
  const title = titleFromForm || file.name.replace(/\.[^.]+$/, "").slice(0, 300) || "Imported recording";
  const meeting = await meetingsRepo.createMeeting(ctx, {
    title,
    source: "upload",
    startedAt: new Date(),
  });

  const storageKey = newStorageKey(session.orgId, meeting.id, mime, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(storageKey, buffer, mime);

  const recording = await withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(recordings)
      .values({
        orgId: session.orgId,
        meetingId: meeting.id,
        storageKey,
        kind: "audio",
        codec: ext,
        sizeBytes: buffer.length,
      })
      .returning({ id: recordings.id });
    return rows[0];
  });

  await enqueue("transcribe", {
    orgId: session.orgId,
    meetingId: meeting.id,
    recordingId: recording.id,
  });
  await recordAudit(session, {
    action: "recording.uploaded",
    targetType: "meeting",
    targetId: meeting.id,
    metadata: { bytes: buffer.length, mime, recordingId: recording.id },
    ip: clientIp(request),
  });

  return json({ meeting, recordingId: recording.id, status: "processing" }, { status: 202 });
});
