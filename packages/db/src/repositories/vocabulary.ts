import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { vocabularyTerms } from "../schema";

export interface VocabularyTermRow {
  id: string;
  term: string;
  kind: "name" | "term" | "acronym";
  scope: "personal" | "workspace";
  createdByName: string | null;
  createdAt: string;
}

export async function listVocabulary(ctx: TenantContext): Promise<VocabularyTermRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: vocabularyTerms.id,
        term: vocabularyTerms.term,
        kind: vocabularyTerms.kind,
        userId: vocabularyTerms.userId,
        createdByName: sql<string>`coalesce((select u.name from users u where u.id = ${vocabularyTerms.userId}), 'Workspace')`,
        createdAt: vocabularyTerms.createdAt,
      })
      .from(vocabularyTerms)
      .where(eq(vocabularyTerms.orgId, ctx.orgId))
      .orderBy(asc(vocabularyTerms.term));
    return rows.map((row) => ({
      id: row.id,
      term: row.term,
      kind: row.kind as VocabularyTermRow["kind"],
      scope: row.userId ? "personal" : "workspace",
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function addVocabularyTerm(
  ctx: TenantContext,
  input: { term: string; kind: "name" | "term" | "acronym"; scope: "personal" | "workspace" },
): Promise<{ id: string } | { ok: false; reason: "duplicate" }> {
  return withTenant(ctx, async (tx) => {
    const userId = input.scope === "personal" ? ctx.userId : null;
    try {
      const rows = await tx
        .insert(vocabularyTerms)
        .values({
          orgId: ctx.orgId,
          userId,
          term: input.term.trim().slice(0, 200),
          kind: input.kind,
        })
        .returning({ id: vocabularyTerms.id });
      return { id: rows[0].id };
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } })?.code
        ?? (error as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505" || String(error).toLowerCase().includes("unique")) {
        return { ok: false, reason: "duplicate" };
      }
      throw error;
    }
  });
}

export async function deleteVocabularyTerm(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(vocabularyTerms)
      .where(and(eq(vocabularyTerms.id, id), eq(vocabularyTerms.orgId, ctx.orgId)))
      .returning({ id: vocabularyTerms.id });
    return { ok: rows.length > 0 };
  });
}
