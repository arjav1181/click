import { z } from "zod";
import { skillsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  recipeId: z.string().uuid(),
  trigger: z.enum(["manual", "on_meeting_ready", "daily", "weekly", "monthly"]).default("manual"),
  targetFilter: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const skills = await skillsRepo.listSkills({ orgId: session.orgId, userId: session.id });
  return json({ skills });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  const created = await skillsRepo.createSkill({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "skill.created",
    targetType: "skill",
    targetId: created.id,
    metadata: { recipeId: body.recipeId },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
