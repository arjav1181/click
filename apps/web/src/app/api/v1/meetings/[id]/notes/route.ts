import { z } from "zod";
import { meetingsRepo, notesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const meeting = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const note = await notesRepo.getNote({ orgId: session.orgId, userId: session.id }, id);
  return json({ note });
});

const schema = z.object({ rawMarkdown: z.string().max(200_000) });

export const PUT = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const meeting = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  const body = await parseJson(request, schema);
  const noteId = await notesRepo.upsertRawNote({ orgId: session.orgId, userId: session.id }, id, body.rawMarkdown);
  await recordAudit(session, {
    action: "note.edited",
    targetType: "note",
    targetId: noteId,
    metadata: { meetingId: id },
    ip: clientIp(request),
  });
  const note = await notesRepo.getNote({ orgId: session.orgId, userId: session.id }, id);
  return json({ note });
});
