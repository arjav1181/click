import { z } from "zod";
import { vocabularyRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  term: z.string().trim().min(1, "Enter a term.").max(200),
  kind: z.enum(["name", "term", "acronym"]).default("term"),
  scope: z.enum(["personal", "workspace"]).default("personal"),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const terms = await vocabularyRepo.listVocabulary({ orgId: session.orgId, userId: session.id });
  return json({ terms });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  const result = await vocabularyRepo.addVocabularyTerm(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  if ("ok" in result && result.ok === false) {
    throw new ApiError(409, "duplicate_term", "That term already exists in this scope.");
  }

  await recordAudit(session, {
    action: "vocabulary.added",
    targetType: "vocabulary_term",
    targetId: (result as { id: string }).id,
    metadata: { term: body.term, scope: body.scope },
    ip: clientIp(request),
  });
  return json(result, { status: 201 });
});
