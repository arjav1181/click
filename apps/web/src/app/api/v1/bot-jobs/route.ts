import { botsRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const jobs = await botsRepo.listBotJobs({ orgId: session.orgId, userId: session.id });
  return json({ jobs });
});
