import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z
  .object({
    text: z.string().trim().min(1).max(20_000).optional(),
    speakerId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.text !== undefined || value.speakerId !== undefined, {
    message: "Send text or a speaker to update.",
  });

export const PATCH = handler(
  async (request, context: { params: Promise<{ id: string; segmentId: string }> }) => {
    assertSameOrigin(request);
    const session = await requireOrgSession();
    const { id, segmentId } = await context.params;
    const body = await parseJson(request, schema);
    const updated = await meetingsRepo.updateSegment(
      { orgId: session.orgId, userId: session.id },
      id,
      segmentId,
      body,
    );
    if (!updated) throw new ApiError(404, "not_found", "Transcript segment not found.");
    await recordAudit(session, {
      action: "transcript.segment_edited",
      targetType: "transcript_segment",
      targetId: segmentId,
      metadata: { meetingId: id, fields: Object.keys(body) },
      ip: clientIp(request),
    });
    return json({ ok: true });
  },
);
