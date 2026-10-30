import { meetingsRepo, notesRepo } from "@click/db";
import {
  EXPORT_CONTENT_TYPES,
  renderDocx,
  renderJson,
  renderMarkdown,
  renderPdf,
  renderSrt,
  renderText,
  renderVtt,
  type ExportFormat,
  type ExportPayload,
} from "@click/backend";
import { ApiError } from "@/server/http";

export interface ExportContext {
  orgId: string;
  userId: string;
}

/** Collects everything a meeting can be exported as. */
export async function buildExportPayload(
  ctx: ExportContext,
  meetingId: string,
): Promise<ExportPayload> {
  const meeting = await meetingsRepo.getMeeting(ctx, meetingId);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const note = await notesRepo.getNote(ctx, meetingId);
  const transcript = await meetingsRepo.getTranscript(ctx, meetingId);

  return {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      durationSeconds: meeting.durationSeconds,
      language: meeting.language,
      source: meeting.source,
      status: meeting.status,
      privacy: meeting.privacy,
      ownerName: meeting.ownerName,
    },
    note: note
      ? {
          rawMarkdown: note.rawMarkdown,
          generatedAt: note.generatedAt,
          sections: note.sections.map((section) => ({
            id: section.id,
            title: section.title,
            body: section.body,
          })),
        }
      : null,
    segments: transcript.segments.map((segment) => ({
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      speakerName: segment.speakerName,
    })),
  };
}

/**
 * Renders one meeting in the requested format. MP3 is not rendered here: it
 * is the stored recording, which the route streams straight from storage.
 */
export function renderExport(format: ExportFormat, payload: ExportPayload): Buffer {
  switch (format) {
    case "md":
      return Buffer.from(renderMarkdown(payload), "utf8");
    case "txt":
      return Buffer.from(renderText(payload), "utf8");
    case "json":
      return Buffer.from(renderJson(payload), "utf8");
    case "srt":
      return Buffer.from(renderSrt(payload), "utf8");
    case "vtt":
      return Buffer.from(renderVtt(payload), "utf8");
    case "pdf":
      return renderPdf(payload);
    case "docx":
      return renderDocx(payload);
    default:
      throw new ApiError(422, "unsupported_format", "That format cannot be rendered.");
  }
}

export function exportContentType(format: ExportFormat): string {
  return EXPORT_CONTENT_TYPES[format];
}
