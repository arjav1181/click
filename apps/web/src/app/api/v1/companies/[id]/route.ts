import { peopleRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const company = await peopleRepo.getCompany({ orgId: session.orgId, userId: session.id }, id);
  if (!company) throw new ApiError(404, "not_found", "That company does not exist.");
  return json({ company });
});
