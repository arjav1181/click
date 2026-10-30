import { developersRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const { id } = await context.params;
  const deliveries = await developersRepo.listWebhookDeliveries(
    { orgId: session.orgId, userId: session.id },
    id,
    50,
  );
  return json({ deliveries });
});
