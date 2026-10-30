import { chatRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const thread = await chatRepo.getThread({ orgId: session.orgId, userId: session.id }, id);
  if (!thread) throw new ApiError(404, "not_found", "That thread does not exist.");
  const messages = await chatRepo.listMessages({ orgId: session.orgId, userId: session.id }, id);
  return json({ thread, messages });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const result = await chatRepo.deleteThread({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That thread does not exist.");
  await recordAudit(session, {
    action: "chat_thread.deleted",
    targetType: "chat_thread",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
