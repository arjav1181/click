import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { legalHolds, users } from "../schema";

export interface LegalHoldRow {
  id: string;
  name: string;
  description: string | null;
  custodianIds: string[];
  custodianNames: string[];
  scope: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
}

export async function listLegalHolds(ctx: TenantContext): Promise<LegalHoldRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: legalHolds.id,
        name: legalHolds.name,
        description: legalHolds.description,
        custodianIds: legalHolds.custodianIds,
        scope: legalHolds.scope,
        releasedAt: legalHolds.releasedAt,
        createdAt: legalHolds.createdAt,
      })
      .from(legalHolds)
      .where(eq(legalHolds.orgId, ctx.orgId))
      .orderBy(desc(legalHolds.createdAt));
    const result: LegalHoldRow[] = [];
    for (const row of rows) {
      const custodians = row.custodianIds.length
        ? await tx
            .select({ name: users.name })
            .from(users)
            .where(sql`${users.id} in (${sql.join(
              row.custodianIds.map((value) => sql`${value}::uuid`),
              sql`, `,
            )})`)
        : [];
      result.push({
        id: row.id,
        name: row.name,
        description: row.description,
        custodianIds: row.custodianIds,
        custodianNames: custodians.map((c) => c.name),
        scope: (row.scope ?? {}) as Record<string, unknown>,
        releasedAt: row.releasedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return result;
  });
}

export async function createLegalHold(
  ctx: TenantContext,
  input: { name: string; description?: string; custodianIds?: string[]; scope?: Record<string, unknown> },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(legalHolds)
      .values({
        orgId: ctx.orgId,
        name: input.name.slice(0, 200),
        description: input.description?.slice(0, 2000) ?? null,
        custodianIds: input.custodianIds ?? [],
        scope: input.scope ?? {},
      })
      .returning({ id: legalHolds.id });
    return { id: rows[0].id };
  });
}

export async function releaseLegalHold(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: legalHolds.id, releasedAt: legalHolds.releasedAt })
      .from(legalHolds)
      .where(and(eq(legalHolds.id, id), eq(legalHolds.orgId, ctx.orgId)))
      .limit(1);
    if (!rows[0]) return { ok: false };
    if (rows[0].releasedAt) return { ok: true };
    await tx.update(legalHolds).set({ releasedAt: new Date() }).where(eq(legalHolds.id, id));
    return { ok: true };
  });
}

export async function deleteLegalHold(ctx: TenantContext, id: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(legalHolds)
      .where(and(eq(legalHolds.id, id), eq(legalHolds.orgId, ctx.orgId)))
      .returning({ id: legalHolds.id });
    return { ok: rows.length > 0 };
  });
}
