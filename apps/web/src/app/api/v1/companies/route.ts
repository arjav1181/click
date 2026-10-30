import { peopleRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const companies = await peopleRepo.listCompanies({ orgId: session.orgId, userId: session.id }, q);
  return json({ companies });
});
