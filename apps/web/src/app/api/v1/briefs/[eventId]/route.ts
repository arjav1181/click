import { briefsRepo } from "@click/db";
import { handler, json, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (_request, context: { params: Promise<{ eventId: string }> }) => {
  const session = await requireOrgSession();
  const { eventId } = await context.params;
  const brief = await briefsRepo.buildBrief({ orgId: session.orgId, userId: session.id }, eventId);
  if (!brief) throw new ApiError(404, "not_found", "That event does not exist.");
  return json({ brief });
});
