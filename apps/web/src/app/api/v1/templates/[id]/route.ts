import { z } from "zod";
import { notesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession, requireRole } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const sectionSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  prompt: z.string().trim().max(8000).nullable().optional(),
  sections: z.array(sectionSchema).max(30).optional(),
  scope: z.enum(["personal", "workspace"]).optional(),
});

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const template = await notesRepo.getTemplate({ orgId: session.orgId, userId: session.id }, id);
  if (!template) throw new ApiError(404, "not_found", "That template does not exist.");
  return json({ template });
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const existing = await notesRepo.getTemplate({ orgId: session.orgId, userId: session.id }, id);
  if (!existing) throw new ApiError(404, "not_found", "That template does not exist.");
  if (existing.isBuiltin) {
    throw new ApiError(409, "builtin_template", "Built-in templates cannot be edited.");
  }
  if (body.scope === "workspace" || existing.scope === "workspace") {
    requireRole(session, ["owner", "admin"]);
  }

  const result = await notesRepo.updateTemplate(
    { orgId: session.orgId, userId: session.id },
    id,
    body,
  );
  if (!result.ok) {
    if (result.reason === "builtin") {
      throw new ApiError(409, "builtin_template", "Built-in templates cannot be edited.");
    }
    throw new ApiError(404, "not_found", "That template does not exist.");
  }

  await recordAudit(session, {
    action: "template.updated",
    targetType: "template",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const template = await notesRepo.getTemplate({ orgId: session.orgId, userId: session.id }, id);
  return json({ template });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;

  const existing = await notesRepo.getTemplate({ orgId: session.orgId, userId: session.id }, id);
  if (!existing) throw new ApiError(404, "not_found", "That template does not exist.");
  if (existing.isBuiltin) {
    throw new ApiError(409, "builtin_template", "Built-in templates cannot be deleted.");
  }
  if (existing.scope === "workspace") {
    requireRole(session, ["owner", "admin"]);
  }

  const result = await notesRepo.deleteTemplate({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) {
    if (result.reason === "builtin") {
      throw new ApiError(409, "builtin_template", "Built-in templates cannot be deleted.");
    }
    throw new ApiError(404, "not_found", "That template does not exist.");
  }

  await recordAudit(session, {
    action: "template.deleted",
    targetType: "template",
    targetId: id,
    metadata: { name: existing.name },
    ip: clientIp(request),
  });
  return json({ ok: true });
});
