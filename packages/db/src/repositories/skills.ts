import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { recipes, skillRuns, skills } from "../schema";

export interface SkillRow {
  id: string;
  recipeId: string;
  recipeName: string;
  trigger: string;
  targetFilter: Record<string, unknown>;
  outputTargets: unknown[];
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

export interface SkillRunRow {
  id: string;
  skillId: string;
  skillName: string;
  meetingIds: string[];
  status: string;
  outputMarkdown: string | null;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export async function listSkills(ctx: TenantContext): Promise<SkillRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: skills.id,
        recipeId: skills.recipeId,
        recipeName: sql<string>`coalesce((select r.name from recipes r where r.id = ${skills.recipeId}), 'Unknown')`,
        trigger: skills.trigger,
        targetFilter: skills.targetFilter,
        outputTargets: skills.outputTargets,
        enabled: skills.enabled,
        lastRunAt: skills.lastRunAt,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(eq(skills.orgId, ctx.orgId))
      .orderBy(desc(skills.createdAt));
    return rows.map((row) => ({
      id: row.id,
      recipeId: row.recipeId,
      recipeName: row.recipeName,
      trigger: row.trigger,
      targetFilter: (row.targetFilter ?? {}) as Record<string, unknown>,
      outputTargets: (row.outputTargets ?? []) as unknown[],
      enabled: row.enabled,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function createSkill(
  ctx: TenantContext,
  input: { recipeId: string; trigger?: string; targetFilter?: Record<string, unknown>; outputTargets?: unknown[]; enabled?: boolean },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(skills)
      .values({
        orgId: ctx.orgId,
        recipeId: input.recipeId,
        trigger: (input.trigger ?? "manual") as never,
        targetFilter: input.targetFilter ?? {},
        outputTargets: input.outputTargets ?? [],
        enabled: input.enabled ?? true,
        createdBy: ctx.userId,
      })
      .returning({ id: skills.id });
    return { id: rows[0].id };
  });
}

export async function updateSkill(
  ctx: TenantContext,
  id: string,
  patch: { recipeId?: string; trigger?: string; targetFilter?: Record<string, unknown>; outputTargets?: unknown[]; enabled?: boolean },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: skills.id })
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.recipeId !== undefined) values.recipeId = patch.recipeId;
    if (patch.trigger !== undefined) values.trigger = patch.trigger;
    if (patch.targetFilter !== undefined) values.targetFilter = patch.targetFilter;
    if (patch.outputTargets !== undefined) values.outputTargets = patch.outputTargets;
    if (patch.enabled !== undefined) values.enabled = patch.enabled;
    await tx.update(skills).set(values).where(eq(skills.id, id));
    return { ok: true };
  });
}

export async function deleteSkill(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(skills)
      .where(and(eq(skills.id, id), eq(skills.orgId, ctx.orgId)))
      .returning({ id: skills.id });
    return { ok: rows.length > 0 };
  });
}

export async function listSkillRuns(ctx: TenantContext, limit = 50): Promise<SkillRunRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: skillRuns.id,
        skillId: skillRuns.skillId,
        skillName: sql<string>`coalesce((select r.name from skills sk left join recipes r on r.id = sk.recipe_id where sk.id = ${skillRuns.skillId}), 'Unknown')`,
        meetingIds: skillRuns.meetingIds,
        status: skillRuns.status,
        outputMarkdown: skillRuns.outputMarkdown,
        error: skillRuns.error,
        tokensIn: skillRuns.tokensIn,
        tokensOut: skillRuns.tokensOut,
        startedAt: skillRuns.startedAt,
        finishedAt: skillRuns.finishedAt,
        createdAt: skillRuns.createdAt,
      })
      .from(skillRuns)
      .where(eq(skillRuns.orgId, ctx.orgId))
      .orderBy(desc(skillRuns.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      skillName: row.skillName,
      meetingIds: row.meetingIds ?? [],
      status: row.status,
      outputMarkdown: row.outputMarkdown,
      error: row.error,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}
