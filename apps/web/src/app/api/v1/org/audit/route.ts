import { workspaceRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
  const events = await workspaceRepo.listAuditEvents({ orgId: session.orgId, userId: session.id }, limit);
  return json({ events });
});
