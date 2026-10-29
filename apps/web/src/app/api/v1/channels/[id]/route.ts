import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, clientIp, handler, json, parseJson } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const channel = await workspaceRepo.getChannel({ orgId: session.orgId, userId: session.id }, id);
  if (!channel) {
    return json({ channel: null, members: [] });
  }
  const members = await workspaceRepo.listChannelMembers({ orgId: session.orgId, userId: session.id }, id);
  return json({
    channel: { ...channel, archivedAt: channel.archivedAt?.toISOString() ?? null },
    members,
  });
});

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  archived: z.boolean().optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);
  const updated = await workspaceRepo.updateChannel({ orgId: session.orgId, userId: session.id }, id, body);
  if (!updated) {
    return json({ error: { code: "not_found", message: "Channel not found." } }, { status: 404 });
  }
  await recordAudit(session, {
    action: "channel.updated",
    targetType: "channel",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const channel = await workspaceRepo.getChannel({ orgId: session.orgId, userId: session.id }, id);
  return json({ channel: channel ? { ...channel, archivedAt: channel.archivedAt?.toISOString() ?? null } : null });
});
