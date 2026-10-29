import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const folders = await workspaceRepo.listFolders({ orgId: session.orgId, userId: session.id });
  return json({ folders });
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
  spaceId: z.string().uuid().nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, schema);
  const folder = await workspaceRepo.createFolder({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "folder.created",
    targetType: "folder",
    targetId: folder.id,
    ip: clientIp(request),
  });
  return json({ folder }, { status: 201 });
});
