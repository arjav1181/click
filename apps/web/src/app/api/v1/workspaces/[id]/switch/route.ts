import { assertSameOrigin, handler, json, clientIp, ApiError } from "@/server/http";
import { authRepo } from "@click/db";
import { requireSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/**
 * Switches the account to another workspace. The choice is stored on the
 * account, so it follows the user to every browser and device.
 */
export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { id } = await context.params;

  const workspace = await authRepo.switchWorkspace({ userId: session.id, orgId: id });
  if (!workspace) {
    throw new ApiError(404, "not_found", "You are not a member of that workspace.");
  }

  await recordAudit(
    { orgId: workspace.orgId, id: session.id },
    {
      action: "org.switched",
      targetType: "organization",
      targetId: workspace.orgId,
      ip: clientIp(request),
    },
  );

  return json({
    workspace: {
      id: workspace.orgId,
      name: workspace.orgName,
      slug: workspace.orgSlug,
      role: workspace.role,
      isActive: true,
    },
  });
});
