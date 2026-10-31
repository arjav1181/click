import { calendarsRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? 14) || 14, 31);
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const events = await calendarsRepo.listCalendarEvents({ orgId: session.orgId, userId: session.id }, { from, to });
  const rules = await calendarsRepo.listCalendarRules({ orgId: session.orgId, userId: session.id });
  return json({ events, rules });
});
