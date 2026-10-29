import { z } from "zod";
import { meetingsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const meeting = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!meeting) throw new ApiError(404, "not_found", "Meeting not found.");
  return json({ meeting });
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  privacy: z.enum(["private", "workspace", "link"]).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);
  const existing = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!existing) throw new ApiError(404, "not_found", "Meeting not found.");
  if (body.privacy && existing.ownerId !== session.id && session.role === "member") {
    throw new ApiError(403, "forbidden", "Only the owner or an admin can change who can see this meeting.");
  }
  const meeting = await meetingsRepo.updateMeeting({ orgId: session.orgId, userId: session.id }, id, body);
  await recordAudit(session, {
    action: "meeting.updated",
    targetType: "meeting",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ meeting });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const existing = await meetingsRepo.getMeeting({ orgId: session.orgId, userId: session.id }, id);
  if (!existing) throw new ApiError(404, "not_found", "Meeting not found.");
  if (existing.ownerId !== session.id && !["owner", "admin"].includes(session.role)) {
    throw new ApiError(403, "forbidden", "Only the meeting owner or an admin can delete this meeting.");
  }
  await meetingsRepo.softDeleteMeeting({ orgId: session.orgId, userId: session.id }, id);
  await recordAudit(session, {
    action: "meeting.deleted",
    targetType: "meeting",
    targetId: id,
    ip: clientIp(request),
  });
  return new Response(null, { status: 204 });
});
