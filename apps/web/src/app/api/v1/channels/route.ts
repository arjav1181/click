import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const channels = await workspaceRepo.listChannels({ orgId: session.orgId, userId: session.id });
  return json({ channels });
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  visibility: z.enum(["public", "private"]).default("public"),
  description: z.string().trim().max(500).nullable().optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);
  const channel = await workspaceRepo.createChannel({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "channel.created",
    targetType: "channel",
    targetId: channel.id,
    ip: clientIp(request),
  });
  return json({ channel }, { status: 201 });
});
