import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const prefs = await workspaceRepo.getNotificationPrefs({ orgId: session.orgId, userId: session.id });
  return json({ prefs });
});

const patchSchema = z.object({
  digest: z.boolean().optional(),
  mentions: z.boolean().optional(),
  followUps: z.boolean().optional(),
  reminders: z.boolean().optional(),
  quietHours: z.boolean().optional(),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, patchSchema);

  const prefs = await workspaceRepo.updateNotificationPrefs({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "notifications.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ prefs });
});
