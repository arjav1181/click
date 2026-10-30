import { meetingsRepo, notesRepo, sharingRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";

export const GET = handler(async (request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params;
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  const resolved = await sharingRepo.resolveShare(token);
  if (!resolved) throw new ApiError(404, "not_found", "This link is invalid or has been revoked.");

  if (resolved.revokedAt) {
    throw new ApiError(410, "revoked", "This share link has been revoked.");
  }
  if (resolved.expiresAt && new Date(resolved.expiresAt) < new Date()) {
    throw new ApiError(410, "expired", "This share link has expired.");
  }

  if (resolved.hasPassword) {
    if (!password) {
      throw new ApiError(401, "password_required", "This share is password-protected.");
    }
    const ok = await sharingRepo.verifySharePassword(token, password);
    if (!ok) throw new ApiError(403, "invalid_password", "That password is not correct.");
  }

  // Read the meeting under the owning org's tenant context.
  const ctx = { orgId: resolved.orgId, userId: "00000000-0000-0000-0000-000000000000" };
  const meeting = await meetingsRepo.getMeeting(ctx, resolved.meetingId);
  if (!meeting) throw new ApiError(404, "not_found", "The meeting behind this link no longer exists.");
  const note = await notesRepo.getNote(ctx, resolved.meetingId);
  const transcript = await meetingsRepo.getTranscript(ctx, resolved.meetingId);

  return json({
    meeting: {
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      durationSeconds: meeting.durationSeconds,
      ownerName: meeting.ownerName,
    },
    note: note
      ? {
          rawMarkdown: note.rawMarkdown,
          sections: note.sections.map((section) => ({
            id: section.id,
            title: section.title,
            body: section.body,
          })),
        }
      : null,
    transcript: transcript.segments.map((segment) => ({
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      speakerName: segment.speakerName,
    })),
  });
});
