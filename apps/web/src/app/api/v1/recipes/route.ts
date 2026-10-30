import { z } from "zod";
import { recipesRepo } from "@click/db";
import { assertSameOrigin, handler, json, parseJson, clientIp, ApiError } from "@/server/http";
import { requireOrgSession } from "@/server/auth";
import { recordAudit } from "@/server/audit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the recipe a name.").max(120),
  prompt: z.string().trim().min(1, "Write a prompt.").max(8000),
  scope: z.enum(["single", "multi"]).default("single"),
  model: z.string().trim().max(120).optional(),
  visibility: z.enum(["private", "workspace", "link"]).default("private"),
});

export const GET = handler(async () => {
  const session = await requireOrgSession();
  const recipes = await recipesRepo.listRecipes({ orgId: session.orgId, userId: session.id });
  return json({ recipes });
});

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const session = await requireOrgSession();
  const body = await parseJson(request, createSchema);

  const created = await recipesRepo.createRecipe(
    { orgId: session.orgId, userId: session.id },
    body,
  );
  await recordAudit(session, {
    action: "recipe.created",
    targetType: "recipe",
    targetId: created.id,
    metadata: { name: body.name },
    ip: clientIp(request),
  });
  return json(created, { status: 201 });
});
