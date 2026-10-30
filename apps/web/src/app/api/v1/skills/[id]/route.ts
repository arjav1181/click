import { z } from "zod";
import { skillsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  recipeId: z.string().uuid().optional(),
  trigger: z.enum(["manual", "on_meeting_ready", "daily", "weekly", "monthly"]).optional(),
  targetFilter: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await skillsRepo.updateSkill({ orgId: session.orgId, userId: session.id }, id, body);
  if (!result.ok) throw new ApiError(404, "not_found", "That skill does not exist.");

  await recordAudit(session, {
    action: "skill.updated",
    targetType: "skill",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ ok: true });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;

  const result = await skillsRepo.deleteSkill({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That skill does not exist.");

  await recordAudit(session, {
    action: "skill.deleted",
    targetType: "skill",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
