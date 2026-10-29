import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/**
 * Removes a workspace provider row. The pipeline then falls back to the
 * operator's environment configuration.
 */
export const DELETE = handler(
  async (request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const session = await requireOrgSession();
    requireRole(session, ["owner", "admin"]);
    const { id } = await context.params;
    const ctx = { orgId: session.orgId, userId: session.id };
    const removed = await workspaceRepo.deleteProviderConfig(ctx, id);
    if (!removed) throw new ApiError(404, "not_found", "That provider is not registered.");

    await recordAudit(session, {
      action: "ai.provider.removed",
      targetType: "provider_config",
      targetId: id,
      ip: clientIp(request),
    });

    const providers = await workspaceRepo.listProviderConfigs(ctx);
    return json({ providers });
  },
);
