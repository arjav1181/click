import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { recipes } from "../schema";

export interface RecipeRow {
  id: string;
  name: string;
  prompt: string;
  scope: "single" | "multi";
  model: string | null;
  visibility: "private" | "workspace" | "link";
  version: number;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export async function listRecipes(ctx: TenantContext): Promise<RecipeRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: recipes.id,
        name: recipes.name,
        prompt: recipes.prompt,
        scope: recipes.scope,
        model: recipes.model,
        visibility: recipes.visibility,
        version: recipes.version,
        ownerId: recipes.ownerId,
        ownerName: sql<string>`coalesce((select u.name from users u where u.id = ${recipes.ownerId}), 'Unknown')`,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(eq(recipes.orgId, ctx.orgId))
      .orderBy(desc(recipes.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      scope: row.scope as RecipeRow["scope"],
      model: row.model,
      visibility: row.visibility as RecipeRow["visibility"],
      version: row.version,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

export async function getRecipe(ctx: TenantContext, id: string): Promise<RecipeRow | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: recipes.id,
        name: recipes.name,
        prompt: recipes.prompt,
        scope: recipes.scope,
        model: recipes.model,
        visibility: recipes.visibility,
        version: recipes.version,
        ownerId: recipes.ownerId,
        ownerName: sql<string>`coalesce((select u.name from users u where u.id = ${recipes.ownerId}), 'Unknown')`,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.orgId, ctx.orgId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      scope: row.scope as RecipeRow["scope"],
      model: row.model,
      visibility: row.visibility as RecipeRow["visibility"],
      version: row.version,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function createRecipe(
  ctx: TenantContext,
  input: { name: string; prompt: string; scope?: "single" | "multi"; model?: string | null; visibility?: "private" | "workspace" | "link" },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(recipes)
      .values({
        orgId: ctx.orgId,
        ownerId: ctx.userId,
        name: input.name.slice(0, 120),
        prompt: input.prompt.slice(0, 8000),
        scope: input.scope ?? "single",
        model: input.model ?? null,
        visibility: input.visibility ?? "private",
      })
      .returning({ id: recipes.id });
    return { id: rows[0].id };
  });
}

export async function updateRecipe(
  ctx: TenantContext,
  id: string,
  patch: { name?: string; prompt?: string; scope?: "single" | "multi"; model?: string | null; visibility?: "private" | "workspace" | "link" },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = { updatedAt: new Date(), version: sql`${recipes.version} + 1` };
    if (patch.name !== undefined) values.name = patch.name.slice(0, 120);
    if (patch.prompt !== undefined) values.prompt = patch.prompt.slice(0, 8000);
    if (patch.scope !== undefined) values.scope = patch.scope;
    if (patch.model !== undefined) values.model = patch.model;
    if (patch.visibility !== undefined) values.visibility = patch.visibility;
    await tx.update(recipes).set(values).where(eq(recipes.id, id));
    return { ok: true };
  });
}

export async function deleteRecipe(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.orgId, ctx.orgId)))
      .returning({ id: recipes.id });
    return { ok: rows.length > 0 };
  });
}
