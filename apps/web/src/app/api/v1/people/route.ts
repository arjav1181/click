import { z } from "zod";
import { peopleRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson } from "@/server/http";
import { requireOrgSession } from "@/server/auth";

const querySchema = z.object({ q: z.string().trim().max(200).optional() });

export const GET = handler(async (request) => {
  const session = await requireOrgSession();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const people = await peopleRepo.listPeople({ orgId: session.orgId, userId: session.id }, q);
  return json({ people });
});
