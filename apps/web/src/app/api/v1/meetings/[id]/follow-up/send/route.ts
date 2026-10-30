import { z } from "zod";
import { followupRepo } from "@click/db";
import { enqueue } from "@click/backend";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const schema = z.object({
  toAddrs: z.array(z.string().trim().email()).min(1, "Add at least one recipient."),
});

export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const draft = await followupRepo.getOrCreateDraft({ orgId: session.orgId, userId: session.id }, id);
  if (draft.status === "sent" || draft.status === "expired") {
    throw new ApiError(409, "not_editable", "This draft can no longer be sent.");
  }

  await followupRepo.updateDraft({ orgId: session.orgId, userId: session.id }, draft.id, {
    toAddrs: body.toAddrs,
  });
  await followupRepo.markDraftSent({ orgId: session.orgId, userId: session.id }, draft.id);

  const refreshed = await followupRepo.getOrCreateDraft({ orgId: session.orgId, userId: session.id }, id);
  await enqueue("email", {
    to: refreshed.toAddrs.join(", "),
    subject: refreshed.subject,
    text: refreshed.body,
    html: `<pre>${refreshed.body}</pre>`,
  });

  await recordAudit(session, {
    action: "followup.sent",
    targetType: "email_draft",
    targetId: draft.id,
    metadata: { to: refreshed.toAddrs },
    ip: clientIp(request),
  });

  return json({ draft: refreshed });
});
