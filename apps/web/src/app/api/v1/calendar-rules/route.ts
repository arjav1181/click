import { z } from "zod";
import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const rules = await calendarsRepo.listCalendarRules({ orgId: session.orgId, userId: session.id });
  return json({ rules });
});

const createSchema = z.object({
  connectionId: z.string().uuid().nullable().optional(),
  titlePattern: z.string().trim().max(200).nullable().optional(),
  hostPattern: z.string().trim().max(200).nullable().optional(),
  attendeeEmail: z.string().trim().toLowerCase().email().nullable().optional(),
  autoJoin: z.boolean().default(true),
  priority: z.number().int().min(1).max(1000).optional(),
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  const rule = await calendarsRepo.createCalendarRule({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "calendar_rule.created",
    targetType: "calendar_rule",
    targetId: rule.id,
    metadata: { autoJoin: body.autoJoin },
    ip: clientIp(request),
  });
  return json(rule, { status: 201 });
});
