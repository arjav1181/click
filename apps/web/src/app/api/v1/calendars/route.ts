import { z } from "zod";
import { calendarsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  accountEmail: z.string().trim().toLowerCase().email("Use a valid email address."),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const connections = await calendarsRepo.listCalendarConnections({ orgId: session.orgId, userId: session.id });
  return json({ connections });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  const created = await calendarsRepo.createCalendarConnection(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "calendar.connected",
    targetType: "calendar_connection",
    targetId: created.id,
    metadata: { provider: body.provider },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
