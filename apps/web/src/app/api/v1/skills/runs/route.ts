import { skillsRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const runs = await skillsRepo.listSkillRuns({ orgId: session.orgId, userId: session.id });
  return json({ runs });
});
