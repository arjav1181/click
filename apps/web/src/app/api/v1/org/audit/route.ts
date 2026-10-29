import { workspaceRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const url = new URL(request.url);
  const params = url.searchParams;

  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
  const action = params.get("action")?.trim() || undefined;
  const actorId = params.get("actorId")?.trim() || undefined;
  const targetType = params.get("targetType")?.trim() || undefined;

  const sinceParam = params.get("since")?.trim();
  const untilParam = params.get("until")?.trim();
  const since = sinceParam ? new Date(sinceParam) : undefined;
  const until = untilParam ? new Date(untilParam) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    return json({ error: { code: "invalid_request", message: "That start date is not valid." } }, { status: 422 });
  }
  if (until && Number.isNaN(until.getTime())) {
    return json({ error: { code: "invalid_request", message: "That end date is not valid." } }, { status: 422 });
  }

  const events = await workspaceRepo.listAuditEvents(
    { orgId: session.orgId, userId: session.id },
    { limit, offset, action, actorId, targetType, since, until },
  );
  const actions = await workspaceRepo.listAuditActions({ orgId: session.orgId, userId: session.id });
  return json({ events, actions });
});
