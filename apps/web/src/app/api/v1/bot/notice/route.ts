import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const notice = await workspaceRepo.getBotNotice({ orgId: session.orgId, userId: session.id });
  return json({ notice });
});

const patchSchema = z.object({
  notice: z.string().trim().min(1).max(2000),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);

  const notice = await workspaceRepo.updateBotNotice({ orgId: session.orgId, userId: session.id }, body.notice);
  await recordAudit(session, {
    action: "bot_notice.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ notice });
});
