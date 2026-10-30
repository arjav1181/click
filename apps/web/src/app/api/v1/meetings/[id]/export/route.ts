import { meetingsRepo } from "@click/db";
import { exportFilename, getObject, isExportFormat } from "@click/backend";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import {
  buildExportPayload,
  exportContentType,
  renderExport,
} from "@/server/export";

export const GET = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };

  const url = new URL(request.url);
  const requested = (url.searchParams.get("format") ?? "md").toLowerCase();
  if (!isExportFormat(requested)) {
    throw new ApiError(422, "unsupported_format", "Pick one of md, txt, pdf, docx, srt, vtt, json or mp3.");
  }
  const format = requested;

  const payload = await buildExportPayload(ctx, id);

  if (format === "mp3") {
    const recording = await meetingsRepo.getMeetingRecording(ctx, id);
    if (!recording) {
      throw new ApiError(409, "no_audio", "This meeting has no stored recording to export.");
    }
    const object = await getObject(recording.storageKey);
    if (!object) {
      throw new ApiError(409, "no_audio", "The recording for this meeting is no longer available.");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of object.body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${exportFilename(payload.meeting.title, "mp3")}"`,
        "Content-Length": String(body.length),
      },
    });
  }

  const body = renderExport(format, payload);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": exportContentType(format),
      "Content-Disposition": `attachment; filename="${exportFilename(payload.meeting.title, format)}"`,
      "Content-Length": String(body.length),
    },
  });
});
