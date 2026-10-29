import { z } from "zod";
import { searchRepo } from "@click/db";
import { aiConfig, embedTexts } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({ q: z.string().trim().min(2).max(500) });

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  if (!aiConfig().embeddings.enabled) {
    throw new ApiError(501, "embeddings_disabled", "Semantic search is off. The operator can enable it with EMBEDDINGS_ENABLED=true.");
  }
  await recordAudit(session, {
    action: "search.semantic",
    targetType: "search",
    targetId: session.orgId,
    ip: clientIp(request),
  });
  const body = await parseJson(request, schema);
  const vectors = await embedTexts([body.q]);
  if (!vectors?.[0]) throw new ApiError(502, "embedding_failed", "The embedding provider did not return a vector.");
  const results = await searchRepo.searchSemantic({ orgId: session.orgId, userId: session.id }, vectors[0], 30);
  return json({ results, query: body.q });
});
