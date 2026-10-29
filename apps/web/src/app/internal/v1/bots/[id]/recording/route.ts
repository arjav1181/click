import { eq } from "drizzle-orm";
import { botsRepo, recordings, meetings, withTenant } from "@click/db";
import { enqueue, extensionFor, newStorageKey, putObject, uploadLimits } from "@click/backend";
import { handler, json, ApiError } from "@/server/http";
import { readVerifiedBody } from "@/server/bot";

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { raw } = await readVerifiedBody(request);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new ApiError(415, "unsupported_media_type", "Send the recording as multipart form data.");
  }
  const limits = uploadLimits();
  if (raw.length > limits.maxBytes) {
    throw new ApiError(413, "file_too_large", "The recording exceeds this instance's upload limit.");
  }
  const bytes = new Uint8Array(raw.byteLength);
  bytes.set(raw);
  const form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(422, "file_required", "Attach the recording file.");
  }

  const job = await botsRepo.findBotJob(id);
  if (!job) throw new ApiError(404, "not_found", "Bot job not found.");

  const mime = file.type || "application/octet-stream";
  const key = newStorageKey(job.orgId, job.meetingId, mime, file.name || `bot.${extensionFor(mime)}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(key, buffer, mime);

  const recording = await withTenant(
    { orgId: job.orgId, userId: "00000000-0000-0000-0000-000000000000" },
    async (tx) => {
      const rows = await tx
        .insert(recordings)
        .values({
          orgId: job.orgId,
          meetingId: job.meetingId,
          storageKey: key,
          kind: "audio",
          codec: extensionFor(mime),
          sizeBytes: buffer.length,
        })
        .returning({ id: recordings.id });
      await tx.update(meetings).set({ status: "processing", endedAt: new Date() }).where(eq(meetings.id, job.meetingId));
      return rows[0];
    },
  );

  await botsRepo.updateBotJobState(job, { state: "completed", endedAt: new Date() });
  await enqueue("transcribe", { orgId: job.orgId, meetingId: job.meetingId, recordingId: recording.id });
  return json({ ok: true, recordingId: recording.id }, { status: 202 });
});
