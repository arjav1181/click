import { z } from "zod";
import { legalHoldRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the hold a name.").max(200),
  description: z.string().trim().max(2000).optional(),
  custodianIds: z.array(z.string().uuid()).max(50).optional(),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const holds = await legalHoldRepo.listLegalHolds({ orgId: session.orgId, userId: session.id });
  return json({ holds });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, createSchema);

  const created = await legalHoldRepo.createLegalHold(
    { orgId: session.orgId, userId: session.id },
    body,
  );

  await recordAudit(session, {
    action: "legal_hold.created",
    targetType: "legal_hold",
    targetId: created.id,
    metadata: { name: body.name },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
