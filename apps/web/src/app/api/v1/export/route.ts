import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { exportFilename, getObject, isExportFormat, zip } from "@click/backend";
import { assertSameOrigin, handler, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";
import { buildExportPayload, renderExport } from "@/server/export";

const schema = z.object({
  meetingIds: z.array(z.string().uuid()).min(1, "Pick at least one meeting.").max(100),
  format: z.string().trim().toLowerCase().default("md"),
});

/**
 * Bulk export. Every selected meeting becomes one file in a zip archive, so
 * the browser gets a single download instead of a hundred.
 */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);

  if (!isExportFormat(body.format)) {
    throw new ApiError(
      422,
      "unsupported_format",
      "Pick one of md, txt, pdf, docx, srt, vtt, json or mp3.",
    );
  }
  const format = body.format;

  const ctx = { orgId: session.orgId, userId: session.id };
  const files: Array<{ name: string; data: Buffer }> = [];
  const skipped: string[] = [];

  for (const meetingId of body.meetingIds) {
    try {
      const payload = await buildExportPayload(ctx, meetingId);
      if (format === "mp3") {
        const recording = await meetingsRepo.getMeetingRecording(ctx, meetingId);
        if (!recording) {
          skipped.push(payload.meeting.title);
          continue;
        }
        const object = await getObject(recording.storageKey);
        if (!object) {
          skipped.push(payload.meeting.title);
          continue;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of object.body as AsyncIterable<Buffer>) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({
          name: exportFilename(payload.meeting.title, "mp3"),
          data: Buffer.concat(chunks),
        });
        continue;
      }
      files.push({
        name: exportFilename(payload.meeting.title, format),
        data: renderExport(format, payload),
      });
    } catch {
      // A meeting that vanished between the list and the export is skipped
      // instead of failing the whole archive.
      skipped.push(meetingId);
    }
  }

  if (files.length === 0) {
    throw new ApiError(
      409,
      "nothing_to_export",
      "None of the selected meetings could be exported.",
    );
  }

  await recordAudit(session, {
    action: "meeting.exported",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { format, count: files.length, skipped: skipped.length },
    ip: clientIp(request),
  });

  const archive = zip(files);
  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="click-export-${format}.zip"`,
      "Content-Length": String(archive.length),
      "X-Exported-Count": String(files.length),
      "X-Skipped-Count": String(skipped.length),
    },
  });
});
