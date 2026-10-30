import { z } from "zod";
import { followupRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  toAddrs: z.array(z.string().trim().email()).max(50).optional(),
  ccAddrs: z.array(z.string().trim().email()).max(50).optional(),
  bccAddrs: z.array(z.string().trim().email()).max(50).optional(),
  subject: z.string().trim().max(300).optional(),
  body: z.string().max(50000).optional(),
});

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const draft = await followupRepo.getOrCreateDraft({ orgId: session.orgId, userId: session.id }, id);
  return json({ draft });
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const draft = await followupRepo.getOrCreateDraft({ orgId: session.orgId, userId: session.id }, id);
  const result = await followupRepo.updateDraft({ orgId: session.orgId, userId: session.id }, draft.id, body);
  if (!result.ok) throw new ApiError(409, "not_editable", "This draft can no longer be edited.");

  await recordAudit(session, {
    action: "followup.updated",
    targetType: "email_draft",
    targetId: draft.id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const refreshed = await followupRepo.getOrCreateDraft({ orgId: session.orgId, userId: session.id }, id);
  return json({ draft: refreshed });
});
