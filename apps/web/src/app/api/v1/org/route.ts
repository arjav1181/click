import { z } from "zod";
import { workspaceRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

/**
 * The organization row also carries the raw settings blob, which holds the AI
 * policy. That is a separate screen, so only the workspace fields leave this
 * route.
 */
function toOrgDto(org: Awaited<ReturnType<typeof workspaceRepo.getOrganization>>) {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    domainAllowlist: org.domainAllowlist,
    createdAt: org.createdAt.toISOString(),
  };
}

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  const members = await workspaceRepo.listMembers({ orgId: session.orgId, userId: session.id });
  const defaults = await workspaceRepo.getWorkspaceDefaults({
    orgId: session.orgId,
    userId: session.id,
  });
  return json({
    org: toOrgDto(org),
    defaults,
    role: session.role,
    counts: {
      members: members.length,
      active: members.filter((member) => member.status === "active").length,
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1, "Give the workspace a name.").max(120).optional(),
  logoUrl: z.string().url("Use a full https:// link.").max(2000).nullable().optional(),
});

export const PATCH = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, patchSchema);
  await workspaceRepo.updateOrganization({ orgId: session.orgId, userId: session.id }, body);
  await recordAudit(session, {
    action: "org.updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  return json({ org: toOrgDto(org) });
});

const defaultsSchema = z.object({
  autoSummarize: z.boolean().optional(),
  defaultLanguage: z.string().trim().min(2).max(20).optional(),
  defaultPrivacy: z.enum(["private", "workspace"]).optional(),
});

export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner", "admin"]);
  const body = await parseJson(request, defaultsSchema);
  const defaults = await workspaceRepo.updateWorkspaceDefaults(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "org.defaults_updated",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  return json({ defaults });
});

const deleteSchema = z.object({
  // The workspace name has to be typed back, so nobody deletes a workspace by
  // accident.
  confirmName: z.string().trim().min(1).max(120),
});

export const DELETE = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  requireRole(session, ["owner"]);
  const body = await parseJson(request, deleteSchema);

  const org = await workspaceRepo.getOrganization({ orgId: session.orgId, userId: session.id });
  if (!org) throw new ApiError(404, "not_found", "Workspace not found.");
  if (body.confirmName !== org.name) {
    throw new ApiError(422, "name_mismatch", "Type the workspace name exactly to confirm.");
  }

  await recordAudit(session, {
    action: "org.deleted",
    targetType: "organization",
    targetId: session.orgId,
    metadata: { name: org.name },
    ip: clientIp(request),
  });
  await workspaceRepo.deleteOrganization({ orgId: session.orgId, userId: session.id });
  return json({ ok: true });
});
