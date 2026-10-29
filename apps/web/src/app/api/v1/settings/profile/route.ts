import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireSession, sessionDto } from "@/server/auth";
import { recordAudit } from "@/server/audit";
import type { OrgSession } from "@/server/auth";

export const GET = handler(async () => {
  const session = await requireSession();
  return json(sessionDto(session));
});

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
});

export const PATCH = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const body = await parseJson(request, schema);
  await workspaceRepo.updateProfile({ orgId: session.orgId ?? "00000000-0000-0000-0000-000000000000", userId: session.id }, body);
  if (session.orgId) {
    await recordAudit(session as OrgSession, {
      action: "profile.updated",
      targetType: "user",
      targetId: session.id,
      metadata: { fields: Object.keys(body) },
      ip: clientIp(request),
    });
  }
  const updated = { ...session, ...body };
  return json(sessionDto(updated));
});
