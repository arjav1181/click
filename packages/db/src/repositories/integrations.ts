import { and, asc, eq, sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";
import { integrationConnections, integrations } from "../schema";

export interface IntegrationCatalogRow {
  key: string;
  name: string;
  category: string;
  authKind: string;
  scopes: string[];
  docsUrl: string | null;
}

export interface IntegrationConnectionRow {
  id: string;
  integrationKey: string;
  status: "connected" | "error" | "revoked";
  config: Record<string, unknown>;
  connectedAt: string;
  connectedByName: string | null;
}

export async function listIntegrations(ctx: TenantContext): Promise<{
  catalog: IntegrationCatalogRow[];
  connections: IntegrationConnectionRow[];
}> {
  return withTenant(ctx, async (tx) => {
    const catalogRows = await tx
      .select({
        key: integrations.key,
        name: integrations.name,
        category: integrations.category,
        authKind: integrations.authKind,
        scopes: integrations.scopes,
        docsUrl: integrations.docsUrl,
      })
      .from(integrations)
      .orderBy(asc(integrations.category), asc(integrations.name));

    const connectionRows = await tx
      .select({
        id: integrationConnections.id,
        integrationKey: integrationConnections.integrationKey,
        status: integrationConnections.status,
        config: integrationConnections.config,
        connectedAt: integrationConnections.connectedAt,
        connectedByName: sql<string>`coalesce((select u.name from users u where u.id = ${integrationConnections.userId}), 'Unknown')`,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.orgId, ctx.orgId));

    return {
      catalog: catalogRows.map((row) => ({
        key: row.key,
        name: row.name,
        category: row.category,
        authKind: row.authKind,
        scopes: row.scopes ?? [],
        docsUrl: row.docsUrl ?? null,
      })),
      connections: connectionRows.map((row) => ({
        id: row.id,
        integrationKey: row.integrationKey,
        status: row.status as IntegrationConnectionRow["status"],
        config: (row.config ?? {}) as Record<string, unknown>,
        connectedAt: row.connectedAt.toISOString(),
        connectedByName: row.connectedByName,
      })),
    };
  });
}

export async function connectIntegration(
  ctx: TenantContext,
  input: { integrationKey: string; config?: Record<string, unknown> },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .insert(integrationConnections)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        integrationKey: input.integrationKey,
        config: input.config ?? {},
        status: "connected",
      })
      .onConflictDoUpdate({
        target: [integrationConnections.orgId, integrationConnections.integrationKey, integrationConnections.userId],
        set: {
          config: input.config ?? {},
          status: "connected",
          updatedAt: new Date(),
        },
      })
      .returning({ id: integrationConnections.id });
    return { id: rows[0].id };
  });
}

export async function updateIntegration(
  ctx: TenantContext,
  key: string,
  patch: { config?: Record<string, unknown>; status?: "connected" | "error" | "revoked" },
): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.orgId, ctx.orgId),
          eq(integrationConnections.integrationKey, key),
        ),
      )
      .limit(1);
    if (!rows[0]) return { ok: false };
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.config !== undefined) values.config = patch.config;
    if (patch.status !== undefined) values.status = patch.status;
    await tx
      .update(integrationConnections)
      .set(values)
      .where(eq(integrationConnections.id, rows[0].id));
    return { ok: true };
  });
}

export async function disconnectIntegration(ctx: TenantContext, key: string): Promise<{ ok: boolean }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .delete(integrationConnections)
      .where(
        and(
          eq(integrationConnections.orgId, ctx.orgId),
          eq(integrationConnections.integrationKey, key),
        ),
      )
      .returning({ id: integrationConnections.id });
    return { ok: rows.length > 0 };
  });
}
