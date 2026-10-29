import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await workspaceRepo.listActionItems({ orgId: session.orgId, userId: session.id }, status);
  return json({ items });
});

const schema = z.object({
  meetingId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  assigneeName: z.string().trim().max(120).optional(),
  dueAt: z.string().datetime().optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);
  const item = await workspaceRepo.createActionItem({ orgId: session.orgId, userId: session.id }, {
    meetingId: body.meetingId,
    text: body.text,
    assigneeName: body.assigneeName,
    dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
  });
  await recordAudit(session, {
    action: "action_item.created",
    targetType: "action_item",
    targetId: item.id,
    metadata: { meetingId: body.meetingId },
    ip: clientIp(request),
  });
  return json({ item }, { status: 201 });
});
