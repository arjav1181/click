import { z } from "zod";
import { authRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, limit } from "@/server/http";
import { requireSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/**
 * Workspaces an account belongs to. The list is account-wide, so it is not
 * tenant-scoped: the switcher needs every workspace, not just the open one.
 */
export const GET = handler(async () => {
  const session = await requireSession();
  const workspaces = await authRepo.listMemberships(session.id);
  return json({
    workspaces: workspaces.map((row) => ({
      id: row.orgId,
      name: row.orgName,
      slug: row.orgSlug,
      role: row.role,
      isActive: row.orgId === session.orgId,
    })),
    activeOrgId: session.orgId,
  });
});

const schema = z.object({
  name: z.string().trim().min(1, "Give the workspace a name.").max(120),
});

/**
 * Creates a workspace owned by the caller and opens it. Every workspace is an
 * organization with memberships, so the creator becomes its owner.
 */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireSession();
  await limit(request, "workspace-create", 10, 60 * 60_000);
  const body = await parseJson(request, schema);

  const workspace = await authRepo.createWorkspace({ userId: session.id, name: body.name });
  await recordAudit(
    { orgId: workspace.id, id: session.id },
    {
      action: "org.created",
      targetType: "organization",
      targetId: workspace.id,
      metadata: { name: workspace.name },
      ip: clientIp(request),
    },
  );
  return json({ workspace }, { status: 201 });
});
