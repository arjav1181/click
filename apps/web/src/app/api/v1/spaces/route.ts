import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, clientIp, handler, json, parseJson } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const spaces = await workspaceRepo.listSpaces({ orgId: session.orgId, userId: session.id });
  return json({ spaces });
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["personal", "team", "custom"]).default("team"),
  description: z.string().trim().max(500).nullable().optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);
  const space = await workspaceRepo.createSpace({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "space.created",
    targetType: "space",
    targetId: space.id,
    metadata: { kind: body.kind },
    ip: clientIp(request),
  });
  return json({ space }, { status: 201 });
});
