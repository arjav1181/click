import { z } from "zod";
import { integrationsRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["connected", "error", "revoked"]).optional(),
});

export const PATCH = handler(async (request, context: { params: Promise<{ key: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { key } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await integrationsRepo.updateIntegration(
    { orgId: session.orgId, userId: session.id },
    key,
    body,
  );
  if (!result.ok) throw new ApiError(404, "not_found", "That integration is not connected.");

  await recordAudit(session, {
    action: "integration.updated",
    targetType: "integration",
    targetId: key,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ ok: true });
});

export const DELETE = handler(async (request, context: { params: Promise<{ key: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { key } = await context.params;

  const result = await integrationsRepo.disconnectIntegration({ orgId: session.orgId, userId: session.id }, key);
  if (!result.ok) throw new ApiError(404, "not_found", "That integration is not connected.");

  await recordAudit(session, {
    action: "integration.disconnected",
    targetType: "integration",
    targetId: key,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
