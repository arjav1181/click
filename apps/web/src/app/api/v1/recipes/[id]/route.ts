import { z } from "zod";
import { recipesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  prompt: z.string().trim().min(1).max(8000).optional(),
  scope: z.enum(["single", "multi"]).optional(),
  model: z.string().trim().max(120).nullable().optional(),
  visibility: z.enum(["private", "workspace", "link"]).optional(),
});

export const GET = handler(async (_request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireOrgSession();
  const { id } = await context.params;
  const recipe = await recipesRepo.getRecipe({ orgId: session.orgId, userId: session.id }, id);
  if (!recipe) throw new ApiError(404, "not_found", "That recipe does not exist.");
  return json({ recipe });
});

export const PATCH = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const result = await recipesRepo.updateRecipe({ orgId: session.orgId, userId: session.id }, id, body);
  if (!result.ok) throw new ApiError(404, "not_found", "That recipe does not exist.");

  await recordAudit(session, {
    action: "recipe.updated",
    targetType: "recipe",
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: clientIp(request),
  });
  const recipe = await recipesRepo.getRecipe({ orgId: session.orgId, userId: session.id }, id);
  return json({ recipe });
});

export const DELETE = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const { id } = await context.params;

  const result = await recipesRepo.deleteRecipe({ orgId: session.orgId, userId: session.id }, id);
  if (!result.ok) throw new ApiError(404, "not_found", "That recipe does not exist.");

  await recordAudit(session, {
    action: "recipe.deleted",
    targetType: "recipe",
    targetId: id,
    metadata: {},
    ip: clientIp(request),
  });
  return json({ ok: true });
});
