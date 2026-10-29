import { meetingsRepo, notesRepo } from "@click/db";
import { handler, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

function safeFilename(title: string, ext: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "meeting"}.${ext}`;
}

export const GET = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const ctx = { orgId: session.orgId, userId: session.id };
  const meeting = await meetingsRepo.getMeeting(ctx, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  const note = await notesRepo.getNote(ctx, id);
  const transcript = await meetingsRepo.getTranscript(ctx, id);

  if (format === "json") {
    return new Response(JSON.stringify({ meeting, note, transcript: transcript.segments }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(meeting.title, "json")}"`,
      },
    });
  }

  if (format === "txt") {
    const lines = transcript.segments.map((segment) => {
      const seconds = Math.floor(segment.startMs / 1000);
      const stamp = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      return `[${stamp}] ${segment.speakerName ?? "Speaker"}: ${segment.text}`;
    });
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(meeting.title, "txt")}"`,
      },
    });
  }

  const parts = [`# ${meeting.title}`, ""];
  if (meeting.startedAt) {
    parts.push(`_${new Date(meeting.startedAt).toUTCString()} · ${Math.round(meeting.durationSeconds / 60)} min_`, "");
  }
  if (note?.sections.length) {
    for (const section of note.sections) {
      parts.push(`## ${section.title}`, "", section.body.trim(), "");
    }
  } else if (note?.rawMarkdown) {
    parts.push(note.rawMarkdown.trim(), "");
  } else {
    parts.push("_No notes yet._", "");
  }
  if (transcript.segments.length) {
    parts.push("## Transcript", "");
    for (const segment of transcript.segments) {
      const seconds = Math.floor(segment.startMs / 1000);
      const stamp = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      parts.push(`**${segment.speakerName ?? "Speaker"}** · ${stamp}`, "", segment.text, "");
    }
  }
  return new Response(parts.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(meeting.title, "md")}"`,
    },
  });
});
