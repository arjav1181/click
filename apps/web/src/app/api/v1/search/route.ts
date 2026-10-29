import { searchRepo } from "@click/db";
import { handler, json } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 500);
  if (!q) return json({ results: [], query: "" });
  const results = await searchRepo.searchKeyword(
    { orgId: session.orgId, userId: session.id },
    q,
    {
      speaker: url.searchParams.get("speaker") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 30) || 30,
    },
  );
  return json({ results, query: q });
});
